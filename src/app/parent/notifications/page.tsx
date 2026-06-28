"use client";

import PortalLayout from "@/components/layout/PortalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Hammer } from "lucide-react";

export default function PlaceholderPage() {
  return (
    <PortalLayout role="parent" userName="Robert Thompson" pageTitle="Thông báo">
      <Card className="border-dashed border-2 bg-muted/30 h-[400px] flex items-center justify-center">
        <CardContent className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Hammer className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Tính năng đang phát triển</h2>
          <p className="text-muted-foreground mt-2 max-w-[300px]">
            Trang <strong>Thông báo</strong> hiện đang được xây dựng. Vui lòng quay lại sau!
          </p>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
