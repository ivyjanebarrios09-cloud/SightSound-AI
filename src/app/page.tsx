"use client"
import { Navbar } from "@/components/layout/Navbar";
import { AuthWrapper } from "@/components/auth/AuthWrapper";
import ImageProcessor from "@/components/main/ImageProcessor";

export default function Home() {
  return (
    <AuthWrapper>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <ImageProcessor />
        </main>
      </div>
    </AuthWrapper>
  );
}
