/** Never return driver queries, connection details, or provider errors to a client. */
export function actionError(
  error: unknown,
  fallback = "Unable to save this change. Please retry.",
): string {
  if (
    error instanceof Error &&
    error.constructor === Error &&
    !error.cause &&
    !("code" in error)
  ) {
    const message = error.message;
    if (
      message.length <= 400 &&
      !/failed query:|postgres(?:ql)?:\/\/|select .+ from |insert into |update .+ set /i.test(
        message,
      )
    )
      return message;
  }
  return fallback;
}
