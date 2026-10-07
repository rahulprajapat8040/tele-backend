export const otpGenerator = (size: number) => {
  const value = Math.pow(10, size - 1);
  const otp = Math.floor(value + Math.random() * (9 * value));
  return String(otp);
};

export const responseSender = (
  message: string,
  status: number,
  success: boolean,
  data: object | [] | string | number | null | boolean,
) => {
  return { message, status, data, success };
};
