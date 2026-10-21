// Per-instance prototype guard. The edge/proxy must enforce shared limits when scaled.
type Slot = { active: number; count: number; windowAt: number };
const slots = new Map<string, Slot>();
let activeUploads = 0;
export function reserveUploadSlot(
  userId: string,
  now = Date.now(),
): () => void {
  if (slots.size > 1000)
    for (const [key, value] of slots)
      if (value.active === 0 && now - value.windowAt > 60_000)
        slots.delete(key);
  const slot = slots.get(userId) ?? { active: 0, count: 0, windowAt: now };
  if (now - slot.windowAt >= 60_000) {
    slot.count = 0;
    slot.windowAt = now;
  }
  if (slot.active || activeUploads >= 4 || slot.count >= 30)
    throw new Error(
      "Upload capacity reached. Wait a minute and retry this file.",
    );
  slot.active++;
  slot.count++;
  activeUploads++;
  slots.set(userId, slot);
  let released = false;
  return () => {
    if (!released) {
      slot.active--;
      activeUploads--;
      released = true;
    }
  };
}
