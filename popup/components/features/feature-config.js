import {
  ContinueWatchingIcon,
  DubDetectorIcon,
  SmartSearchIcon,
  IntroSkipIcon,
  BingeWatchIcon,
} from "../icons/index.js";

/**
 * Presentation metadata for the five features, in display order.
 *
 *   id          matches FEATURE_SUBOPTIONS keys in content/helpers/storage.js
 *   settingKey  the boolean in DEFAULT_SETTINGS that switches it on/off
 *   color/tint  accent used by its icon, switch and timeline segment
 *   weight      relative width of its segment in the timeline strip
 *   Icon        its icon component (one file each in components/icons/)
 */
export const FEATURES = [
  {
    id: "cw",
    settingKey: "cwEnabled",
    name: "Continue Watching",
    desc: "Resume where you left off",
    color: "#FF4D94",
    tint: "rgba(255, 77, 148, 0.14)",
    weight: 3,
    Icon: ContinueWatchingIcon,
    clearLabel: "Clear list",
  },
  {
    id: "dub",
    settingKey: "dubEnabled",
    name: "DUB Detector",
    desc: "Flags dubbed episodes",
    color: "#FFB02E",
    tint: "rgba(255, 176, 46, 0.14)",
    weight: 2,
    Icon: DubDetectorIcon,
    clearLabel: "Clear cache",
  },
  {
    id: "ss",
    settingKey: "smartSearchEnabled",
    name: "Smart Search",
    desc: "Finds alternate titles",
    color: "#5BB8FF",
    tint: "rgba(91, 184, 255, 0.14)",
    weight: 2,
    Icon: SmartSearchIcon,
    clearLabel: "Clear cache",
  },
  {
    id: "is",
    settingKey: "introSkipEnabled",
    name: "Intro / Outro Skip",
    desc: "Skips openings and endings",
    color: "#A98BFF",
    tint: "rgba(169, 139, 255, 0.14)",
    weight: 3,
    Icon: IntroSkipIcon,
    clearLabel: "Clear cache",
  },
  {
    id: "bw",
    settingKey: "bingeWatchEnabled",
    name: "Binge Watch",
    desc: "Plays the next episode",
    color: "#3DD6A3",
    tint: "rgba(61, 214, 163, 0.14)",
    weight: 2,
    Icon: BingeWatchIcon,
    note: "Off by default. A countdown pill appears when an episode ends. Click it to cancel.",
  },
];
