import "dotenv/config";

const baseUrl = process.env.CANVAS_BASE_URL;
const accessToken = process.env.CANVAS_ACCESS_TOKEN;

if (!baseUrl) {
  throw new Error("CANVAS_BASE_URL is missing");
}

if (!accessToken) {
  throw new Error("CANVAS_ACCESS_TOKEN is missing");
}

async function canvasFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${baseUrl}/api/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Canvas API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export function getCurrentUser() {
  return canvasFetch("/users/self");
}

export function getCourses() {
  return canvasFetch("/courses");
}