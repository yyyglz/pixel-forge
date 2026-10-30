import {it,expect,vi} from 'vitest';
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import TemplateDetail from './page';
import {messages,type MessageKey} from '@/lib/i18n';
vi.mock('@/components/providers',()=>({useUser:()=>({user:1,locale:'zh',isSignedIn:true,openLogin:()=>{},t:(key:MessageKey)=>messages.zh[key]})}));
it('keeps the accepted task visible if history refresh fails',async()=>{
 let listCalls=0; const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status});
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  if(url==='/api/templates/1') return json({data:{id:1,title:'光影肖像',description:'描述',category:'人像',coverUrl:'/covers/portrait.jpg',requiredImageCount:1,acceptedMimeTypes:'image/jpeg,image/png',maxFileSizeBytes:10485760}});
  if(url.startsWith('/api/tasks?')) { if(listCalls++===0)return json({data:[]});return json({error:{message:'offline'}},500); }
  if(url==='/api/assets')return json({data:{assetId:'asset',previewUrl:'/image',filename:'a.jpg',mimeType:'image/jpeg',fileSize:1}});
  if(url==='/api/tasks'&&init?.method==='POST')return json({data:{taskId:'new-task'}},202);
  throw Error('unexpected '+url);
 }));
 const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 await act(async()=>{render(<QueryClientProvider client={client}><TemplateDetail params={Promise.resolve({id:'1'})}/></QueryClientProvider>)});
 await screen.findByText('描述');
 const input=screen.getByLabelText('上传素材 1');
 fireEvent.change(input,{target:{files:[new File(['abc'],'a.jpg',{type:'image/jpeg'})]}});
 const submit=await screen.findByRole('button',{name:/开始制作/});
 await waitFor(()=>expect(submit).toBeEnabled());fireEvent.click(submit);
 expect(await screen.findByText('任务已受理，可在右侧查看进度。')).toBeInTheDocument();
 await waitFor(()=>expect(listCalls).toBeGreaterThan(1));
 expect((await screen.findAllByText(/状态同步失败/)).length).toBeGreaterThan(0);
 expect(document.querySelector('[data-task-id="new-task"]')).toHaveAttribute('data-status', 'QUEUED');
});
