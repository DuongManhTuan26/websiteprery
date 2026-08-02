-- CreateEnum
CREATE TYPE "AIProviderType" AS ENUM ('MOCK', 'OPENAI');

-- CreateTable
CREATE TABLE "chatbots" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT 'You are a helpful assistant.',
    "aiProvider" "AIProviderType" NOT NULL DEFAULT 'MOCK',
    "aiModel" TEXT,
    "widgetToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chatbots_widgetToken_key" ON "chatbots"("widgetToken");

-- CreateIndex
CREATE INDEX "chatbots_workspaceId_idx" ON "chatbots"("workspaceId");

-- AddForeignKey
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
