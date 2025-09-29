'use client';
import { Modal, Input } from 'antd';
import { Welcome, Bubble, Sender } from '@ant-design/x';
import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import { Typography } from 'antd';
type ApiResponse = {
  success: boolean;
  data: { content: string; agentName: string } | string | object;
  result: number;
  text: string;
};

// 预置股票列表已移除，改用远端搜索

export default function HomePage() {
  async function fetchAgent() {
    const res = await fetch('/api/get-agent', {
      method: 'GET'
    });
    const data: ApiResponse = await res.json();
    return data;
  }

  const md: MarkdownIt = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true,
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            '<pre><code class="hljs">' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true })
              .value +
            '</code></pre>'
          );
        } catch {}
      }
      return (
        '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>'
      );
    }
  });

  // 为表格添加样式与滚动容器，并保留 markdown-it 生成的原有属性（如对齐）
  md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
    const attrs = self.renderAttrs(tokens[idx]) || '';
    return `<div class="md-table-wrapper overflow-x-auto my-4"><table class="w-full table-auto border-collapse"${attrs}>`;
  };
  md.renderer.rules.table_close = () => {
    return '</table></div>';
  };
  md.renderer.rules.thead_open = () => {
    return '<thead class="bg-slate-50 dark:bg-slate-800">';
  };
  md.renderer.rules.th_open = (tokens, idx, options, env, self) => {
    const attrs = self.renderAttrs(tokens[idx]) || '';
    return `<th class="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-700 dark:text-slate-200 font-semibold"${attrs}>`;
  };
  md.renderer.rules.td_open = (tokens, idx, options, env, self) => {
    const attrs = self.renderAttrs(tokens[idx]) || '';
    return `<td class="border border-slate-200 dark:border-slate-700 px-3 py-2 align-top"${attrs}>`;
  };
  md.renderer.rules.tbody_open = () => {
    // 斑马纹（可选）
    return '<tbody class="[&>tr:nth-child(odd)>td]:bg-slate-50 dark:[&>tr:nth-child(odd)>td]:bg-slate-900/40">';
  };

  const [hasAgent, setHasAgent] = useState<boolean>(false);
  const [agentName, setAgentName] = useState<string>('');
  function WelcomeCard() {
    if (hasAgent) {
      return (
        <Welcome
          className='text-center'
          title={`Your Agent: ${agentName}`}
          description='You have already created an agent, feel free to chat!'
        />
      );
    }
    return (
      <Welcome
        className='text-center'
        title='Create Your Agent'
        description='upload files to create your agent'
      />
    );
  }

  const [userPrompt, setUserPrompt] = useState('');
  async function chooseFileHandle() {
    let fileName = '';
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fileInput.click();
    fileInput.onchange = async () => {
      if (fileInput.files) {
        const files = Array.from(fileInput.files);

        const form = new FormData();
        for (const f of files) {
          form.append('file', f, f.name); // 与后端转发字段一致
          fileName = f.name;
        }

        setUserPrompt('正在上传文件到服务器，请稍候...');
        try {
          const res = await fetch('/api/update-file', {
            method: 'POST',
            body: form
          });
          if (!res.ok) {
            const msg = await res.text().catch(() => '');
            setUserPrompt(`上传失败：${res.status} ${msg}`);
            return;
          }
          setUserPrompt('文件上传成功，正在生成 Agent，请稍候...');
          await fetch('/api/create-agent-prompt', {
            method: 'POST',
            body: JSON.stringify({ filename: fileName })
          });
          const agentData = await fetchAgent();
          setHasAgent(true);
          setAgentName(
            (agentData.data as { content: string; agentName: string }).agentName
          );
          setUserPrompt(
            (agentData.data as { content: string; agentName: string }).content
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setUserPrompt(`上传异常：${msg}`);
        } finally {
          // 允许重复选择同一文件
          fileInput.value = '';
        }
      }
    };
  }

  function mdRender(content: string) {
    return (
      <Typography>
        <div
          className='markdown-body'
          dangerouslySetInnerHTML={{ __html: md.render(content) }}
        />
      </Typography>
    );
  }

  useEffect(() => {
    // 初始化欢迎语
    fetchAgent().then((res) => {
      if (res.data) {
        setHasAgent(true);
        setAgentName(
          (res.data as { content: string; agentName: string }).agentName
        );
        setUserPrompt(
          (res.data as { content: string; agentName: string }).content
        );
      } else {
        setUserPrompt(
          '欢迎使用 Agent 聊天系统，请上传文件生成您的专属 Agent！'
        );
      }
    });
  }, []);

  function ChatArea() {
    const [value, setValue] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    type ChatRole = 'ai' | 'user';
    type ConversationItem = {
      id: string;
      role: ChatRole;
      content: string;
      loading: boolean;
      messageRender?: () => React.ReactNode;
      typing: boolean | { step: number; interval: number };
    };

    const [conversationList, setConversationList] = useState<
      ConversationItem[]
    >([]);
    async function submitHandle(value: string) {
      if (!stock) {
        setConversationList((prev) => [
          ...prev,
          {
            id: prev.length.toString(),
            role: 'ai',
            content: '请先选择一只股票后再发送问题。',
            loading: false,
            typing: false
          }
        ]);
        return;
      }
      setValue('');
      setLoading(true);
      setConversationList((prev) => [
        ...prev,
        {
          id: conversationList.length.toString(),
          role: 'user',
          content: '已选择：' + (stockName || stock) + '，' + value,
          loading: false,
          typing: false
        }
      ]);
      setConversationList((prev) => [
        ...prev,
        {
          id: conversationList.length.toString(),
          role: 'ai',
          content: '',
          loading: true,
          typing: { step: 3, interval: 14 }
        }
      ]);
      const response = await fetch(
        'https://www.omahaaigc.com/api/FileTest/ExecutionAgent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tscode: stock, agentName })
        }
      );
      if (!response.ok) {
        console.error('ReadableStream is not available on this response.');
        setLoading(false);
        return;
      }
      const responseReal = await fetch(
        'https://www.omahaaigc.com/api/FileTest/GetResult',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      type BufferLike = { type: 'Buffer'; data: number[] };
      type ExecutionResult = { final_summary?: unknown };
      function isBufferLike(v: unknown): v is BufferLike {
        return (
          typeof v === 'object' &&
          v !== null &&
          'type' in v &&
          (v as { type: unknown }).type === 'Buffer' &&
          'data' in v &&
          Array.isArray((v as { data: unknown }).data)
        );
      }

      const dataReal: ApiResponse = await responseReal.json();
      const result = JSON.parse(dataReal.data as string) as ExecutionResult;
      const fs = result?.final_summary;
      let summaryText = '';
      try {
        if (typeof fs === 'string') {
          summaryText = fs;
        } else if (isBufferLike(fs)) {
          summaryText = new TextDecoder('utf-8').decode(
            Uint8Array.from(fs.data)
          );
        } else if (fs instanceof ArrayBuffer) {
          summaryText = new TextDecoder('utf-8').decode(new Uint8Array(fs));
        } else if (Array.isArray(fs)) {
          summaryText = new TextDecoder('utf-8').decode(Uint8Array.from(fs));
        } else {
          summaryText = String(fs ?? '');
        }
      } catch {
        summaryText = String(fs ?? '');
      }
      console.log(summaryText);
      const newItem: ConversationItem = {
        id: conversationList.length.toString(),
        role: 'ai',
        content: summaryText,
        loading: false,
        typing: false,
        messageRender: () => (
          <Typography>
            <div
              className='markdown-body'
              dangerouslySetInnerHTML={{ __html: md.render(summaryText) }}
            />
          </Typography>
        )
      };
      setConversationList((prev) => [
        ...prev.filter((item) => !item.loading),
        newItem
      ]);
      setLoading(false);
    }
    async function cancelHandle() {
      console.log('cancel');
      setLoading(false);
    }

    type TypingConfig = {
      step: number;
      interval: number;
    };

    type RoleConfig = {
      placement: 'start' | 'end';
      typing?: TypingConfig;
      style?: CSSProperties;
    };

    const rolesAsObject: Record<ChatRole, RoleConfig> = {
      ai: {
        placement: 'start',
        typing: { step: 5, interval: 20 },
        style: {
          maxWidth: 600
        }
      },
      user: {
        placement: 'end'
      }
    };

    const [stock, setStock] = useState<string>('');
    const [stockName, setStockName] = useState<string>('');

    // 搜索 Modal 状态
    const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
    const [query, setQuery] = useState<string>('');
    const [searching, setSearching] = useState<boolean>(false);
    type StockItem = { code: string; name: string };
    const [results, setResults] = useState<StockItem[]>([]);
    const [searchError, setSearchError] = useState<string>('');

    // 映射后端返回对象到 { code, name }
    const fetchStocks = useCallback(async (key: string) => {
      if (!key.trim()) {
        setResults([]);
        setSearchError('');
        return;
      }
      setSearching(true);
      setSearchError('');
      try {
        const resp = await fetch(
          `https://www.omahaaigc.com/api/StockBaseInfo/GetListByName?key=${encodeURIComponent(
            key
          )}`,
          { method: 'GET' }
        );
        if (!resp.ok) {
          const msg = await resp.text().catch(() => '');
          throw new Error(`${resp.status}: ${msg}`);
        }
        const data: unknown = await resp.json();
        // 兼容 ApiResponse 或直接数组
        const list = Array.isArray(data)
          ? data
          : typeof data === 'object' &&
            data !== null &&
            Array.isArray((data as { data?: unknown }).data)
          ? ((data as { data?: unknown }).data as unknown[])
          : [];
        const mapped: StockItem[] = list
          .map((it: unknown) => {
            if (typeof it === 'object' && it !== null) {
              const o = it as Record<string, unknown>;
              const codeCandidate =
                o['ts_code'] ||
                o['tsCode'] ||
                o['TSCode'] ||
                o['tscode'] ||
                o['code'] ||
                o['symbol'] ||
                '';
              const nameCandidate =
                o['name'] ||
                o['stockName'] ||
                o['StockName'] ||
                o['cname'] ||
                o['cnName'] ||
                o['security_name_abbr'] ||
                codeCandidate ||
                '';
              return {
                code: String(codeCandidate),
                name: String(nameCandidate)
              };
            }
            return { code: '', name: '' };
          })
          .filter((it: StockItem) => it.code);
        setResults(mapped);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '搜索失败';
        setSearchError(msg);
      } finally {
        setSearching(false);
      }
    }, []);

    // keyup 防抖搜索
    useEffect(() => {
      if (!isSearchOpen) return;
      const handle = setTimeout(() => {
        void fetchStocks(query);
      }, 300);
      return () => clearTimeout(handle);
    }, [query, isSearchOpen, fetchStocks]);

    function openSearch() {
      setIsSearchOpen(true);
      setQuery('');
      setResults([]);
      setSearchError('');
    }

    function onPickStock(item: { code: string; name: string }) {
      setStock(item.code);
      setStockName(item.name || item.code);
      setIsSearchOpen(false);
    }
    return (
      <div className='flex-1 h-full flex flex-col gap-4 border-2  border-indigo-200 boder-solid rounded-2xl p-5'>
        <div className='flex-1 overflow-y-auto'>
          <Bubble.List roles={rolesAsObject} items={conversationList} />
        </div>

        <div className='flex items-center gap-4'>
          <button
            type='button'
            onClick={openSearch}
            className='px-3 py-2 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 hover:bg-indigo-200 w-[220px] text-left'>
            {stockName && stock ? `${stockName} (${stock})` : '请选择股票'}
          </button>
          <Sender
            loading={loading}
            value={value}
            onChange={(v) => {
              setValue(v);
            }}
            onSubmit={submitHandle}
            onCancel={cancelHandle}
            submitType='shiftEnter'
            placeholder='Press Shift + Enter to send message'
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </div>

        <Modal
          open={isSearchOpen}
          onCancel={() => setIsSearchOpen(false)}
          footer={null}
          title='搜索股票（输入名称或代码，按键即搜）'
          centered>
          <div className='flex flex-col gap-3'>
            <Input
              placeholder='例如：中兴、招商银行、000063.SZ'
              allowClear
              onKeyUp={(e) => setQuery((e.target as HTMLInputElement).value)}
            />
            <div className='max-h-80 overflow-y-auto border rounded-md'>
              {searching ? (
                <div className='p-4 text-center text-slate-500'>搜索中...</div>
              ) : searchError ? (
                <div className='p-4 text-center text-red-500'>
                  {searchError}
                </div>
              ) : results.length === 0 ? (
                <div className='p-4 text-center text-slate-400'>无结果</div>
              ) : (
                <ul>
                  {results.map((it) => (
                    <li
                      key={`${it.code}-${it.name}`}
                      className='px-3 py-2 cursor-pointer hover:bg-indigo-50 flex justify-between items-center'
                      onClick={() => onPickStock(it)}>
                      <span className='font-medium text-slate-800'>
                        {it.name}
                      </span>
                      <span className='text-slate-500'>{it.code}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Modal>
      </div>
    );
  }
  return (
    <div className='flex h-full p-5 gap-4'>
      <div className='flex flex-col h-full w-[500px] gap-4'>
        <div className='bg-indigo-50 rounded-2xl flex-1 p-5 flex flex-col gap-4 overflow-y-auto'>
          <WelcomeCard />
          {userPrompt && (
            <Bubble
              typing={{ step: 3, interval: 14 }}
              messageRender={mdRender}
              content={userPrompt}
            />
          )}
        </div>
        <input type='file' className='hidden' multiple />
        <div
          onClick={chooseFileHandle}
          className='cursor-pointer rounded-xl h-[50px] w-full flex justify-center items-center text-xl bg-indigo-200 font-bold text-indigo-900'>
          ➕ 上传文件 生成Agent
        </div>
      </div>
      <ChatArea />
    </div>
  );
}
