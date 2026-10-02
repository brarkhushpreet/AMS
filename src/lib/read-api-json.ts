export async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      `The attendance service returned HTTP ${response.status} without valid JSON. Please retry; if it continues, check the server logs.`,
    );
  }
}
