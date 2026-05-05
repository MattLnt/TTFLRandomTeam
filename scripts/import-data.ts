import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const dataPath = path.join(__dirname, '../../ttfl-scraper/all_members.json')
  const raw = fs.readFileSync(dataPath, 'utf8')
  const data = JSON.parse(raw)

  console.log('🚀 Import des données TTFL...')

  for (const [pseudo, memberData] of Object.entries(data.members) as any) {
    console.log(`\n👤 Import de ${pseudo}...`)

    const totalScore = memberData.historique.reduce((sum: number, p: any) => {
      return sum + (p.bonus ? p.score * 2 : p.score)
    }, 0)

    const member = await prisma.member.upsert({
      where: { pseudo },
      update: { totalScore, updatedAt: new Date() },
      create: { pseudo, totalScore },
    })

    console.log(`✅ Membre ${pseudo} créé/mis à jour`)

    for (const pick of memberData.historique) {
      await prisma.pick.upsert({
        where: { memberId_date: { memberId: member.id, date: pick.date } },
        update: {
          joueur: pick.joueur,
          score: pick.score,
          bonus: pick.bonus,
          pts: pick.pts,
          reb: pick.reb,
          ast: pick.ast,
          stl: pick.stl,
          blk: pick.blk,
          ftm: pick.ftm,
          fgm: pick.fgm,
          fg3m: pick.fg3m,
          malus: pick.malus,
        },
        create: {
          memberId: member.id,
          date: pick.date,
          joueur: pick.joueur,
          score: pick.score,
          bonus: pick.bonus,
          pts: pick.pts,
          reb: pick.reb,
          ast: pick.ast,
          stl: pick.stl,
          blk: pick.blk,
          ftm: pick.ftm,
          fgm: pick.fgm,
          fg3m: pick.fg3m,
          malus: pick.malus,
        },
      })
    }

    console.log(`✅ ${memberData.historique.length} picks importés`)

    if (memberData.deck?.picks) {
      for (const deckPick of memberData.deck.picks) {
        await prisma.deckPick.upsert({
          where: { memberId_date: { memberId: member.id, date: deckPick.date } },
          update: {
            joueur: deckPick.joueur,
            champweek: memberData.deck.champweek,
            picked: deckPick.picked,
            teamColor: deckPick.teamColor,
            score: deckPick.score,
          },
          create: {
            memberId: member.id,
            date: deckPick.date,
            joueur: deckPick.joueur,
            champweek: memberData.deck.champweek,
            picked: deckPick.picked,
            teamColor: deckPick.teamColor,
            score: deckPick.score,
          },
        })
      }
      console.log(`✅ ${memberData.deck.picks.length} deck picks importés`)
    }
  }

  const members = await prisma.member.findMany({
    orderBy: { totalScore: 'desc' }
  })

  for (let i = 0; i < members.length; i++) {
    await prisma.member.update({
      where: { id: members[i].id },
      data: { rank: i + 1 }
    })
  }

  console.log('\n🏆 Rangs calculés et mis à jour')
  console.log('\n🎉 Import terminé !')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())