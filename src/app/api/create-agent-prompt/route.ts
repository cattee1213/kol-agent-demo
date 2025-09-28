import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL = 'https://www.omahaaigc.com/api/FileTest/CreateAgentprompt';

type ApiResponse = {
  success: boolean;
  data?: string | object;
  result: number;
  text: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
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
