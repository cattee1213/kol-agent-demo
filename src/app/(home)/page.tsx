'use client';
import { Welcome, Bubble, Sender } from '@ant-design/x';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';

export default function HomePage() {
  const md: MarkdownIt = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight: function (str, lang, attrs) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            '<pre><code class="hljs">' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true })
              .value +
            '</code></pre>'
          );
        } catch (__) {}
      }

      return (
        '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>'
      );
    }
  });

  function WelcomeCard() {
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
    // const fileInput = document.querySelector(
    //   'input[type="file"]'
    // ) as HTMLInputElement;
    // fileInput.click();
    const response = await fetch('/api/generate-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    // 模拟打字
    setInterval(() => {
      setUserPrompt((prev) => {
        if (prev.length < data.data.length) {
          return data.data.slice(0, prev.length + 1);
        } else {
          return prev;
        }
      });
    });
  }

  function mdRender() {
    return <div dangerouslySetInnerHTML={{ __html: md.render(userPrompt) }} />;
  }

  return (
    <div className='flex h-full p-5 gap-4'>
      <div className='flex flex-col h-full w-[500px] gap-4'>
        <div className='bg-indigo-50 rounded-2xl flex-1 p-5 flex flex-col gap-4 overflow-y-auto'>
          <WelcomeCard />
          {userPrompt && (
            <Bubble messageRender={mdRender} content={userPrompt} />
          )}
        </div>
        <input type='file' className='hidden' />
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

function ChatArea() {
  const [value, setValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  type ChatRole = 'ai' | 'user';
  type ConversationItem = {
    id: string;
    role: ChatRole;
    content: string;
    loading: boolean;
  };

  const [conversationList, setConversationList] = useState<ConversationItem[]>(
    []
  );
  async function submitHandle(value: string) {
    setValue('');
    setLoading(true);
    setConversationList((prev) => [
      ...prev,
      {
        id: conversationList.length.toString(),
        role: 'user',
        content: value,
        loading: false
      }
    ]);
    setConversationList((prev) => [
      ...prev,
      {
        id: conversationList.length.toString(),
        role: 'ai',
        content: '',
        loading: true
      }
    ]);
    setTimeout(() => {
      setConversationList((prev) => {
        const newList = [...prev];
        newList[newList.length - 1] = {
          ...newList[newList.length - 1],
          content: '这是AI的回复'.repeat(10),
          loading: false
        };
        return newList;
      });
      setLoading(false);
    }, 2000);
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
  return (
    <div className='flex-1 h-full flex flex-col gap-4 border-2  border-indigo-200 boder-solid rounded-2xl p-5'>
      <div className='flex-1 overflow-y-auto'>
        <Bubble.List roles={rolesAsObject} items={conversationList} />
      </div>
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
  );
}
