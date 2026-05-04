/** Public URL for a roster `ownerAvatar` filename. */
export function ownerAvatarSrc(
  filename: string | undefined,
): string | undefined {
  if (!filename || filename.length === 0) return undefined;
  return `/avatars/${filename}`;
}
