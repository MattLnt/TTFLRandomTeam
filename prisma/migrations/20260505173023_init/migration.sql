-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "pseudo" TEXT NOT NULL,
    "rank" INTEGER,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "joueur" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "bonus" BOOLEAN NOT NULL DEFAULT false,
    "pts" INTEGER NOT NULL DEFAULT 0,
    "reb" INTEGER NOT NULL DEFAULT 0,
    "ast" INTEGER NOT NULL DEFAULT 0,
    "stl" INTEGER NOT NULL DEFAULT 0,
    "blk" INTEGER NOT NULL DEFAULT 0,
    "ftm" INTEGER NOT NULL DEFAULT 0,
    "fgm" INTEGER NOT NULL DEFAULT 0,
    "fg3m" INTEGER NOT NULL DEFAULT 0,
    "malus" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckPick" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "joueur" TEXT,
    "champweek" TEXT,
    "picked" BOOLEAN NOT NULL DEFAULT false,
    "teamColor" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NBAPlayer" (
    "id" TEXT NOT NULL,
    "bdlId" INTEGER NOT NULL,
    "nbaId" INTEGER,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT,
    "teamId" INTEGER,
    "teamName" TEXT,
    "teamAbbr" TEXT,
    "jerseyNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NBAPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "bdlGameId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "matchup" TEXT,
    "isHome" BOOLEAN NOT NULL DEFAULT true,
    "pts" INTEGER NOT NULL DEFAULT 0,
    "reb" INTEGER NOT NULL DEFAULT 0,
    "ast" INTEGER NOT NULL DEFAULT 0,
    "stl" INTEGER NOT NULL DEFAULT 0,
    "blk" INTEGER NOT NULL DEFAULT 0,
    "ftm" INTEGER NOT NULL DEFAULT 0,
    "fta" INTEGER NOT NULL DEFAULT 0,
    "fgm" INTEGER NOT NULL DEFAULT 0,
    "fga" INTEGER NOT NULL DEFAULT 0,
    "fg3m" INTEGER NOT NULL DEFAULT 0,
    "tov" INTEGER NOT NULL DEFAULT 0,
    "ttflScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NBAGame" (
    "id" TEXT NOT NULL,
    "bdlId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "homeTeamName" TEXT NOT NULL,
    "homeTeamAbbr" TEXT NOT NULL,
    "visitorTeamId" INTEGER NOT NULL,
    "visitorTeamName" TEXT NOT NULL,
    "visitorTeamAbbr" TEXT NOT NULL,
    "status" TEXT,
    "datetime" TEXT,
    "postseason" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NBAGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_pseudo_key" ON "Member"("pseudo");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_memberId_date_key" ON "Pick"("memberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DeckPick_memberId_date_key" ON "DeckPick"("memberId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NBAPlayer_bdlId_key" ON "NBAPlayer"("bdlId");

-- CreateIndex
CREATE UNIQUE INDEX "GameLog_playerId_bdlGameId_key" ON "GameLog"("playerId", "bdlGameId");

-- CreateIndex
CREATE UNIQUE INDEX "NBAGame_bdlId_key" ON "NBAGame"("bdlId");

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckPick" ADD CONSTRAINT "DeckPick_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameLog" ADD CONSTRAINT "GameLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "NBAPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
