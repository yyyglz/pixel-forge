export type Template = {id:number;title:string;description:string;category:string;coverUrl:string;requiredImageCount:number;acceptedMimeTypes:string;maxFileSizeBytes:number};
export type User = {id:number;username:string;displayName:string};
export type Task = {id:string;templateId:number;templateTitle:string;status:'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED';currentStage:string|null;failedStage:string|null;errorMessage:string|null;resultUrl:string|null;createdAt:string;updatedAt:string};
export type Asset = {assetId:string;filename:string;mimeType:string;fileSize:number;previewUrl:string};
export async function api<T>(path:string, options:RequestInit={}, user?:number):Promise<T> {
  const headers = new Headers(options.headers); if(user) headers.set('X-Demo-User-Id',String(user));
  const response = await fetch('/api'+path,{...options,headers});
  const body = await response.json().catch(()=>null);
  if(!response.ok) throw new Error(body?.error?.message || `请求失败 (${response.status})`);
  return body.data as T;
}
export const active = (task:Task) => task.status==='QUEUED'||task.status==='RUNNING';
