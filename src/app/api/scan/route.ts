import { NextResponse } from "next/server";
import { scanCourses } from "@/lib/scan";
import { DriveNotMountedError } from "@/lib/paths";

export async function POST() {
  try {
    const result = scanCourses();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DriveNotMountedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
