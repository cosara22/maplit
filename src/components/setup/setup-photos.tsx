"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface SetupPhotosProps {
  location: {
    logoUrl: string | null;
    coverUrl: string | null;
    photos: string[] | null;
  };
  formValues: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  scoreBreakdown: {
    photos: { score: number; maxScore: number };
  };
}

export function SetupPhotos({
  location,
  formValues,
  onUpdate,
  scoreBreakdown,
}: SetupPhotosProps) {
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  const logoUrl =
    (formValues.logoUrl as string | undefined) ?? location.logoUrl ?? "";
  const coverUrl =
    (formValues.coverUrl as string | undefined) ?? location.coverUrl ?? "";
  const photos =
    (formValues.photos as string[] | undefined) ?? location.photos ?? [];

  const isComplete = scoreBreakdown.photos.score === scoreBreakdown.photos.maxScore;

  const addPhoto = () => {
    if (!newPhotoUrl.trim()) return;
    onUpdate("photos", [...photos, newPhotoUrl.trim()]);
    setNewPhotoUrl("");
  };

  const removePhoto = (index: number) => {
    onUpdate(
      "photos",
      photos.filter((_, i) => i !== index)
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">写真</CardTitle>
        <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
          {scoreBreakdown.photos.score}/{scoreBreakdown.photos.maxScore}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="logoUrl">ロゴ URL</Label>
          <Input
            id="logoUrl"
            value={logoUrl}
            onChange={(e) => onUpdate("logoUrl", e.target.value)}
            placeholder="https://example.com/logo.png"
          />
          {logoUrl && (
            <img
              src={logoUrl}
              alt="ロゴプレビュー"
              className="w-16 h-16 object-cover rounded border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="coverUrl">カバー写真 URL</Label>
          <Input
            id="coverUrl"
            value={coverUrl}
            onChange={(e) => onUpdate("coverUrl", e.target.value)}
            placeholder="https://example.com/cover.jpg"
          />
          {coverUrl && (
            <img
              src={coverUrl}
              alt="カバープレビュー"
              className="w-full h-32 object-cover rounded border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>通常写真（3枚以上推奨）</Label>
          <div className="flex gap-2">
            <Input
              value={newPhotoUrl}
              onChange={(e) => setNewPhotoUrl(e.target.value)}
              placeholder="写真URLを入力"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhoto();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPhoto}
              disabled={!newPhotoUrl.trim()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {photos.map((url, i) => (
                <div
                  key={i}
                  className="relative group w-20 h-20 rounded border overflow-hidden"
                >
                  <img
                    src={String(url)}
                    alt={`写真 ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            現在 {photos.length} 枚 / 3枚以上で満点
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
