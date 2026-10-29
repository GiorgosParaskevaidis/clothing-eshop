export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
// An allowed Unicode character may occupy two UTF-16 code units in an HTML input.
export const PASSWORD_INPUT_MAX_LENGTH = PASSWORD_MAX_LENGTH * 2;
export const PASSWORD_PATTERN =
  '(?=.*\\p{Lu})(?=.*\\p{Ll})(?=.*\\p{Nd})(?=.*[\\p{P}\\p{S}]).{8,128}';
export const PASSWORD_HELP =
  'Use 8–128 characters with an uppercase letter, a lowercase letter, a number and a symbol. Avoid common passwords.';
