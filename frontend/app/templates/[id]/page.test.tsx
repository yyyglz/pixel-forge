import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import TemplateDetail from './page';
import {messages, type MessageKey} from '@/lib/i18n';
const state=vi.hoisted(()=>({locale:'zh' as 'zh'|'en'}));
vi.mock('@/components/providers',()=>({useUser:()=>({user:1,locale:state.locale,isSignedIn:true,openLogin:()=>{},t:(key:MessageKey)=>messages[state.locale][key]})}));
vi.mock('@/components/task-list',()=>({TaskList:()=>null}));
const template={id:1,title:'光影肖像',description:'让你的照片拥有柔和而富有电影感的光影。',category:'人像',coverUrl:'/covers/portrait.jpg',requiredImageCount:1,acceptedMimeTypes:'image/jpeg,image/png',maxFileSizeBytes:10485760};
afterEach(()=>{cleanup();vi.unstubAllGlobals();state.locale='zh';});
describe('模板详情',()=>{
 it('展示当前语言的模板描述',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:template}),{status:200})));
  await act(async()=>{render(<QueryClientProvider client={new QueryClient()}><TemplateDetail params={Promise.resolve({id:'1'})}/></QueryClientProvider>);});
  expect(await screen.findByText(template.description)).toBeInTheDocument();
 });
 it('英文模式展示模板英文描述',async()=>{
  state.locale='en';vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:template}),{status:200})));
  await act(async()=>{render(<QueryClientProvider client={new QueryClient()}><TemplateDetail params={Promise.resolve({id:'1'})}/></QueryClientProvider>);});
  expect(await screen.findByText(/cinematic glow/i)).toBeInTheDocument();
 });
});
