export type KommoUserName = {
  id: number;
  name: string;
};

function compactName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Un solo usuario cuyo nombre es FAG Motors. Si hay cero o varios, no adivina. */
export function fagMotorsUserId(users: KommoUserName[]): number | null {
  const matches = users.filter((user) => compactName(user.name) === 'fagmotors');
  return matches.length === 1 ? matches[0].id : null;
}
