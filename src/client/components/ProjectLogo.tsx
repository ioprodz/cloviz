import { useState } from "react";
import { API_BASE, INITIALS_COLORS, getInitials, getColorIndex, type Project } from "../utils/project";

interface ProjectLogoProps {
  project: Pick<Project, "id" | "display_name" | "logo_path">;
  size?: string;
  rounded?: string;
  textSize?: string;
}

export default function ProjectLogo({
  project,
  size = "w-9 h-9",
  rounded = "rounded-lg",
  textSize = "text-xs",
}: ProjectLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (project.logo_path && !imgFailed) {
    return (
      <img
        src={`${API_BASE}/api/projects/logo/${project.id}`}
        alt=""
        className={`${size} ${rounded} object-contain bg-surface-lighter flex-shrink-0`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  const initials = getInitials(project.display_name);
  const color = INITIALS_COLORS[getColorIndex(project.display_name)];

  return (
    <div
      className={`${size} ${rounded} bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}
    >
      <span className={`${textSize} font-bold text-white/90`}>{initials}</span>
    </div>
  );
}
