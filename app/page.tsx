import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

export default async function Home() {
  const today = getTodayDate()

  // Lecture directe du JSON du scraper
  const jsonPath = path.join(process.cwd(), 'scraper/all_members.json')
  const raw = fs.readFileSync(jsonPath, 'utf8')
  const scraperData = JSON.parse(raw)

  // Membres depuis la DB pour les rangs et scores
  const members = await prisma.member.findMany({
    orderBy: { rank: 'asc' },
  })

  return (
    <main style={{ backgroundColor: '#0f1923', minHeight: '100vh', padding: '32px 24px', fontFamily: 'sans-serif' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#ecdfc2', fontSize: '28px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>
          🏀 Random Team
        </h1>
        <p style={{ color: '#909090', fontSize: '14px', marginTop: '6px' }}>
          Picks du {today}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {members.map((member: any) => {
          const scraperMember = scraperData.members[member.pseudo]
          
          // Pick du jour depuis le deck
          const deckPicks = scraperMember?.deck?.picks || []
          const deckPick = deckPicks.find((p: any) => p.date === today)
          
          // Pick historique du jour (si le match a déjà eu lieu)
          const histoPick = scraperMember?.historique?.find((p: any) => p.date === today)
          
          const joueur = histoPick?.joueur || (deckPick?.picked ? deckPick?.joueur : null)
          const score = histoPick?.score ?? null
          const hasBonus = histoPick?.bonus || false
          const scoreAffiche = hasBonus ? (score ?? 0) * 2 : score

          const borderColor = hasBonus ? '#C8940A' : '#2d3f5e'

          return (
            <div key={member.id} style={{
              backgroundColor: '#1a2535',
              borderRadius: '16px',
              border: `2px solid ${borderColor}`,
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {hasBonus && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  backgroundColor: '#C8940A',
                  color: '#000',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '20px',
                  letterSpacing: '1px',
                }}>
                  ×2 BONUS
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: member.rank === 1 ? '#C8940A' : member.rank === 2 ? '#909090' : member.rank === 3 ? '#A05020' : '#22314a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '14px',
                  flexShrink: 0,
                }}>
                  #{member.rank}
                </div>
                <div>
                  <div style={{ color: '#ecdfc2', fontWeight: 700, fontSize: '16px' }}>
                    {member.pseudo}
                  </div>
                  <div style={{ color: '#909090', fontSize: '12px' }}>
                    Total : {member.totalScore} pts
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#0f1923',
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'center',
                minHeight: '80px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {joueur ? (
                  <>
                    <div style={{ color: '#ecdfc2', fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>
                      {joueur}
                    </div>
                    {score !== null ? (
                      <div style={{
                        color: (scoreAffiche ?? 0) >= 30 ? '#4ade80' : (scoreAffiche ?? 0) >= 0 ? '#ecdfc2' : '#f87171',
                        fontSize: '28px',
                        fontWeight: 900,
                      }}>
                        {scoreAffiche} pts
                        {hasBonus && (
                          <span style={{ fontSize: '13px', color: '#C8940A', marginLeft: '6px' }}>
                            ({score} ×2)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#909090', fontSize: '13px' }}>
                        Match en attente...
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#d75422', fontSize: '13px', fontWeight: 600 }}>
                    ❌ Pas encore de pick
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}