import fs from 'fs';
import path from 'path';

interface Pick {
  date: string;
  joueur: string | null;
  score: number | null;
  picked: boolean;
  teamColor: string | null;
  bonus?: boolean;
}

interface Member {
  pseudo: string;
  rang: number;
  total: number;
  pickDuJour: Pick | null;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HomePage() {
  const filePath = path.join(process.cwd(), 'scraper', 'all_members.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const today = getTodayDate();

  const members: Member[] = Object.entries(data.members)
    .map(([pseudo, m]: [string, any]) => {
      const totalScore = m.historique.reduce((sum: number, p: any) => sum + p.score, 0);
      const todayPickFromDeck = m.deck?.picks?.find((p: any) => p.date === today && p.picked);
      const todayPickFromHisto = m.historique.find((p: any) => p.date === today);
      const pickDuJour = todayPickFromDeck || todayPickFromHisto || null;
      return { pseudo, rang: 0, total: totalScore, pickDuJour };
    })
    .sort((a, b) => b.total - a.total)
    .map((m, idx) => ({ ...m, rang: idx + 1 }));

  const getRankBadge = (rang: number) => {
    if (rang === 1) return { bg: 'linear-gradient(135deg, #FFD700, #C8940A)', text: '#FFFFFF', shadow: '0 4px 20px rgba(200, 148, 10, 0.5)' };
    if (rang === 2) return { bg: 'linear-gradient(135deg, #E8E8E8, #909090)', text: '#FFFFFF', shadow: '0 4px 20px rgba(144, 144, 144, 0.4)' };
    if (rang === 3) return { bg: 'linear-gradient(135deg, #CD7F32, #A05020)', text: '#FFFFFF', shadow: '0 4px 20px rgba(160, 80, 32, 0.4)' };
    return { bg: 'linear-gradient(135deg, #2a3654, #22314a)', text: '#FFFFFF', shadow: '0 4px 20px rgba(0, 0, 0, 0.3)' };
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0f1626 0%, #1a2238 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h1 style={{
            fontSize: '52px',
            fontWeight: '900',
            margin: '0',
            background: 'linear-gradient(135deg, #d75422, #C8940A, #ecdfc2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '2px',
            textShadow: '0 0 30px rgba(215, 84, 34, 0.3)',
          }}>
            🏀 RANDOM TEAM
          </h1>
          <p style={{
            color: '#8a96b8',
            fontSize: '16px',
            marginTop: '8px',
            fontWeight: '500',
            letterSpacing: '1px',
          }}>
            PICKS DU {today.split('-').reverse().join('/')}
          </p>
        </div>

        {/* Grid 5x2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '20px',
        }}>
          {members.map((member) => {
            const badge = getRankBadge(member.rang);
            const hasPick = member.pickDuJour && member.pickDuJour.picked;
            const isFinished = member.pickDuJour?.score !== null && member.pickDuJour?.score !== undefined;
            const teamColor = member.pickDuJour?.teamColor || '#2a3654';

            return (
              <div
                key={member.pseudo}
                style={{
                  background: 'linear-gradient(145deg, #1e2a44, #151d33)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.2s',
                }}
              >
                {/* Glow effet derrière */}
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  right: '-50%',
                  width: '200%',
                  height: '200%',
                  background: `radial-gradient(circle, ${teamColor}15 0%, transparent 60%)`,
                  pointerEvents: 'none',
                }} />

                {/* Header avec rang et nom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', position: 'relative' }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: badge.bg,
                    color: badge.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '900',
                    fontSize: '18px',
                    boxShadow: badge.shadow,
                    flexShrink: 0,
                  }}>
                    #{member.rang}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: '#ffffff',
                      fontWeight: '800',
                      fontSize: '17px',
                      letterSpacing: '0.3px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {member.pseudo}
                    </div>
                    <div style={{ color: '#8a96b8', fontSize: '13px', fontWeight: '500', marginTop: '2px' }}>
                      {member.total} pts
                    </div>
                  </div>
                </div>

                {/* Pick du jour */}
                {hasPick ? (
                  <div style={{
                    background: `linear-gradient(135deg, ${teamColor}40, ${teamColor}10)`,
                    border: `1px solid ${teamColor}60`,
                    borderRadius: '14px',
                    padding: '20px 16px',
                    textAlign: 'center',
                    position: 'relative',
                    minHeight: '110px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}>
                    {member.pickDuJour?.bonus && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '-10px',
                        background: 'linear-gradient(135deg, #FFD700, #d75422)',
                        color: '#1a2238',
                        fontSize: '11px',
                        fontWeight: '900',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        boxShadow: '0 4px 12px rgba(255, 215, 0, 0.4)',
                        letterSpacing: '0.5px',
                      }}>
                        ⚡ ×2
                      </div>
                    )}
                    <div style={{
                      color: '#ffffff',
                      fontWeight: '800',
                      fontSize: '16px',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      lineHeight: '1.3',
                    }}>
                      {member.pickDuJour?.joueur}
                    </div>
                    {isFinished ? (
                      <div style={{
                        marginTop: '10px',
                        fontSize: '32px',
                        fontWeight: '900',
                        color: (member.pickDuJour?.score || 0) >= 30 ? '#4ade80' : (member.pickDuJour?.score || 0) < 0 ? '#ef4444' : '#ecdfc2',
                      }}>
                        {member.pickDuJour?.score} <span style={{ fontSize: '14px', fontWeight: '600', color: '#8a96b8' }}>pts</span>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: '8px',
                        color: '#8a96b8',
                        fontSize: '13px',
                        fontStyle: 'italic',
                      }}>
                        Match en attente...
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '14px',
                    padding: '20px 16px',
                    textAlign: 'center',
                    minHeight: '110px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '14px' }}>
                      ✕ Pas encore pické
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}