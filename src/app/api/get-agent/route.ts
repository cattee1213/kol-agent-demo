import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL = 'https://www.omahaaigc.com/api/FileTest/GetAgent';

type ApiResponse = {
  success: boolean;
  data?: string | object;
  result: number;
  text: string;
};

export async function GET(req: Request) {
  try {
    const res = await fetch(URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data: ApiResponse = await res.json();

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: '请求异常', message: msg },
      { status: 500 }
    );
  }
}
