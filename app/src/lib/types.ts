export type Screen =
  | "home"
  | "director"
  | "storyboard"
  | "scene"
  | "character"
  | "ad"
  | "script"
  | "templates"
  | "magic"
  | "generating"
  | "result"
  | "formats"
  | "voice"
  | "captions"
  | "projects"
  | "slideshow"
  | "music-library"
  | "billing";

export type Mode = "Text → Video" | "Image → Video" | "Director";

export interface SceneData {
  id: number;
  name: string;
  desc: string;
  camera: string;
  motion: string;
  duration: string;
}

export interface ViewState {
  screen: Screen;
  prevScreen: Screen;
  mode: Mode;
  chat: 1 | 2;
  answerPicked: string | null;
  cam: string;
  adStyle: string;
  cap: string;
  voice: string;
  char: string;
  fmt: string[];
  sheet: boolean;
  prog: number;
  credits: string;
  activeSceneId: number;
  realJobId: string | null;
  realPending: boolean;
  realStatusMessage: string | null;
  realResultUrl: string | null;
  realError: string | null;
}
