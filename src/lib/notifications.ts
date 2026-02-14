export async function sendTurnNotification(
  gameId: string,
  userId: string,
  opponentName?: string,
  message?: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId,
        userId,
        opponentName,
        message,
        title: 'Game Night',
      })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}
