export type DataErrorCode =
  | "CONFLICT"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "LAST_ADMIN"
  | "NOT_FOUND"
  | "STORAGE_FAILURE";

const SAFE_MESSAGES: Record<DataErrorCode, string> = {
  CONFLICT: "O registro foi alterado por outra operação.",
  FORBIDDEN: "A operação não é permitida.",
  INVALID_INPUT: "Os dados informados são inválidos.",
  LAST_ADMIN: "O grupo precisa manter ao menos um administrador ativo.",
  NOT_FOUND: "Registro não encontrado.",
  STORAGE_FAILURE: "Não foi possível concluir a operação de dados.",
};

export class FamilyCareDataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "FamilyCareDataError";
    this.code = code;
  }
}

export async function safely<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof FamilyCareDataError) {
      throw error;
    }

    // Deliberately do not retain the database error as `cause`: SQL parameters
    // can contain medical data and must not escape into generic error logging.
    throw new FamilyCareDataError("STORAGE_FAILURE");
  }
}
