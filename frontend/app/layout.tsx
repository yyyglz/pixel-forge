import type { Metadata } from 'next';
import Providers from '@/components/providers';
import './globals.css';
export const metadata:Metadata={title:'PixelForge — 创意素材工作室',description:'从一个模板开始，创造属于你的视觉故事。'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="zh-CN"><body><Providers>{children}</Providers></body></html>;}
