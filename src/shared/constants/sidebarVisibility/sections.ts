import type { SidebarSectionDefinition } from "./types";

/**
 * Bijoy AI Video Maker exposes only the product workflow in normal navigation.
 * OmniRoute's developer routes remain in the codebase for provider internals and
 * direct administrative access, but are intentionally hidden from end users.
 */
export const SIDEBAR_SECTIONS: readonly SidebarSectionDefinition[] = [
  {
    id: "video-maker",
    titleKey: "bijoyVideoMaker",
    titleFallback: "Bijoy AI Video Maker",
    showTitle: false,
    defaultPinned: true,
    children: [
      {
        id: "home",
        href: "/home",
        i18nKey: "home",
        labelFallback: "Dashboard",
        subtitleFallback: "Projects and generation status",
        icon: "dashboard",
        exact: true,
      },
      {
        id: "new-video",
        href: "/video-maker/new",
        i18nKey: "newVideo",
        labelFallback: "New Video",
        subtitleFallback: "Create a 33-scene video project",
        icon: "movie_edit",
      },
      {
        id: "my-projects",
        href: "/video-maker/projects",
        i18nKey: "myProjects",
        labelFallback: "My Projects",
        subtitleFallback: "Open, resume and render projects",
        icon: "video_library",
      },
      {
        id: "avatar-profiles",
        href: "/video-maker/avatars",
        i18nKey: "avatarProfiles",
        labelFallback: "Avatar Profiles",
        subtitleFallback: "Manage presenter reference images",
        icon: "face",
      },
      {
        id: "providers",
        href: "/video-maker/providers",
        i18nKey: "providers",
        labelFallback: "Providers",
        subtitleFallback: "Connect and test AI providers",
        icon: "hub",
      },
      {
        id: "usage",
        href: "/video-maker/usage",
        i18nKey: "usage",
        labelFallback: "Usage",
        subtitleFallback: "Provider jobs and estimated spending",
        icon: "monitoring",
      },
      {
        id: "settings-general",
        href: "/dashboard/settings",
        i18nKey: "settings",
        labelFallback: "Settings",
        subtitleFallback: "Application and provider defaults",
        icon: "settings",
      },
    ],
  },
];
