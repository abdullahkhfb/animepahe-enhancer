export const PAGE = {
  HOME: "home",
  EPISODE_LIST: "episode-list",
  PLAYER: "player",
  OTHER: "other",
};

const ROUTES = [
  { type: PAGE.HOME, pattern: /^\/?$/ },
  { type: PAGE.EPISODE_LIST, pattern: /^\/anime\/([^/]+)\/?$/ },
  { type: PAGE.PLAYER, pattern: /^\/play\/([^/]+)\/([^/]+)\/?$/ },
];

export function getPageType() {
  const path = window.location.pathname;
  for (const route of ROUTES) {
    if (route.pattern.test(path)) return route.type;
  }
  return PAGE.OTHER;
}

export function getPageSessions() {
  const path = window.location.pathname;

  const playerMatch = path.match(/^\/play\/([^/]+)\/([^/]+)/);
  if (playerMatch) {
    return { animeSession: playerMatch[1], epSession: playerMatch[2] };
  }

  const listMatch = path.match(/^\/anime\/([^/]+)/);
  if (listMatch) {
    return { animeSession: listMatch[1] };
  }

  return null;
}
