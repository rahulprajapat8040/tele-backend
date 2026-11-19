import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Contact, User } from '../database/models';
import { IAuthUser } from 'src/lib/interfaces/user.interface';
import { SyncContactDTO } from './dto/contacts.dto';
import {
  generatePagination,
  generatePhoneHash,
  getPagination,
  responseSender,
} from 'src/lib/helper/function.helper';
import { RESPONSE_MESSAGE } from 'src/lib/constant/response-message.constant';
import { Op } from 'sequelize';
import { CommonQueryDTO } from 'src/common/dto/common-query.dto';
import { decrypt } from 'src/lib/helper/encryption.helper';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);
  constructor(
    @InjectModel(Contact) private readonly contactModel: typeof Contact,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  async sync(user: IAuthUser, dto: SyncContactDTO) {
    const { contacts } = dto;

    if (!contacts.length) {
      return responseSender(
        RESPONSE_MESSAGE.NO_CONTACTS,
        HttpStatus.OK,
        true,
        [],
      );
    }

    this.logger.log('Generating unique contact...');

    const uniqueContacts = new Map(
      contacts.map((contact) => {
        const phone = contact.phoneNumber.trim();

        return [
          phone,
          {
            contactName: contact.name,
            phoneHash: generatePhoneHash(phone),
          },
        ];
      }),
    );

    const contactRecords = Array.from(uniqueContacts.values());

    const phoneHashes = contactRecords.map((contact) => contact.phoneHash);

    this.logger.log('Finding matched users...');

    const registeredUsers = await this.userModel.findAll({
      where: {
        phoneHash: {
          [Op.in]: phoneHashes,
        },
      },
      attributes: ['id', 'phoneHash'],
    });

    const userMap = new Map(
      registeredUsers.map((registeredUser) => [
        registeredUser.phoneHash,
        registeredUser.id,
      ]),
    );

    const records = contactRecords.map((contact) => {
      const matchedUserId = userMap.get(contact.phoneHash) ?? undefined;

      if (!matchedUserId) {
        this.logger.warn(
          `User with this phone hash ${contact.phoneHash} not registred`,
        );
      }

      return {
        ownerUserId: user.userId,
        contactName: contact.contactName,
        phoneHash: contact.phoneHash,
        matchedUserId,
      };
    });

    await this.contactModel.bulkCreate(records, {
      updateOnDuplicate: ['contactName', 'matchedUserId', 'updatedAt'],
    });

    this.logger.log(
      `Synchronized ${contactRecords.length} contacts for user ${user.userId}`,
    );

    return responseSender(
      RESPONSE_MESSAGE.DATA_SYNC,
      HttpStatus.CREATED,
      true,
      {
        totalContacts: records.length,
        registeredContacts: records.filter(
          (contact) => contact.matchedUserId !== null,
        ).length,
      },
    );
  }

  async getContacts(user: IAuthUser, query: CommonQueryDTO) {
    const { page, limit, offset } = getPagination(query);
    const { rows, count } = await this.contactModel.findAndCountAll({
      where: {
        ownerUserId: user.userId,
        matchedUserId: {
          [Op.ne]: null,
        },
      },
      include: [
        {
          model: User,
          as: 'matchedUser',
          attributes: ['id', 'firstName', 'lastName', 'userName', 'phoneNo'],
          required: true,
        },
      ],
      limit,
      offset,
      distinct: true,
    });

    const decryptedContacts = rows.map((contact) => {
      const data = contact.dataValues;

      return {
        ...data,
        matchedUser: data.matchedUser
          ? {
              ...data.matchedUser.dataValues,
              phoneNo: data.matchedUser.phoneNo
                ? decrypt(data.matchedUser.phoneNo)
                : null,
            }
          : null,
      };
    });

    const response = generatePagination(
      { rows: decryptedContacts, count },
      page,
      limit,
    );

    return responseSender(
      RESPONSE_MESSAGE.DATA_FETCHED,
      HttpStatus.OK,
      true,
      response,
    );
  }
}
