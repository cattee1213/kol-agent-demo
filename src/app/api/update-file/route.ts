import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://www.omahaaigc.com/api/FileTest/UpdateFile';

export async function POST(req: Request) {
  try {
    const inForm = await req.formData();

    const outForm = new FormData();
    let fileCount = 0;

    // 将所有上传的文件转发为字段名 "file"（如上游要求其他字段名，改这里）
    for (const [, value] of inForm.entries()) {
      if (value instanceof File) {
        outForm.append('file', value, value.name);
        fileCount++;
      }
    }

    if (fileCount === 0) {
      return NextResponse.json(
        {
          error: '未检测到文件，请以 multipart/form-data 提交文件字段（file）'
        },
        { status: 400 }
      );
    }

    // 透传非文件字段
    for (const [key, value] of inForm.entries()) {
      if (!(value instanceof File)) {
        outForm.append(key, String(value));
      }
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30000);

    const upstreamResp = await fetch(UPSTREAM, {
      method: 'POST',
      body: outForm,
      signal: controller.signal
    }).finally(() => clearTimeout(t));

    const contentType = upstreamResp.headers.get('content-type') || '';

    if (!upstreamResp.ok) {
      const msg = await upstreamResp.text().catch(() => '');
      return NextResponse.json(
        { error: '上游接口错误', status: upstreamResp.status, message: msg },
        { status: 502 }
      );
    }

    if (contentType.includes('application/json')) {
      const json = await upstreamResp.json();
      return NextResponse.json(json, { status: 200 });
    } else {
      const buf = await upstreamResp.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: { 'content-type': contentType || 'application/octet-stream' }
      });
    }
  } catch (err: unknown) {
    const isAbortError =
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: string }).name === 'AbortError';

    if (isAbortError) {
      return NextResponse.json({ error: '请求上游超时' }, { status: 504 });
    }

    const detail =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json({ error: '转发失败', detail }, { status: 500 });
  }
}
