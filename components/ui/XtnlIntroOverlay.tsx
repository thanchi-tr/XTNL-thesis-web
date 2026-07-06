"use client";
import { useState, useEffect } from "react";
import { XtnlLogoAnimation } from "./XtnlLogoAnimation";

export default function XtnlIntroOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("xtnl_intro_shown")) return;
    sessionStorage.setItem("xtnl_intro_shown", "1");
    setShow(true);
  }, []);

  if (!show) return null;
  return <XtnlLogoAnimation mode="intro" onDone={() => setShow(false)} />;
}
