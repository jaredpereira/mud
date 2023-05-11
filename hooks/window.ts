// see: https://stackoverflow.com/questions/36862334/get-viewport-window-height-in-reactjs

import { useState, useEffect } from "react";

function getWindowDimensions() {
  const width = window?.innerWidth;
  const height = window?.innerHeight;
  return {
    width,
    height,
  };
}

export default function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(
    getWindowDimensions()
  );

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowDimensions;
}

interface ViewportSize {
  width: number;
  height: number;
}

export function useViewportSize(): ViewportSize {
  let [size, setSize] = useState(() => getViewportSize());

  useEffect(() => {
    // Use visualViewport api to track available height even on iOS virtual keyboard opening
    let onResize = () => {
      setSize((size) => {
        let newSize = getViewportSize();
        if (newSize.width === size.width && newSize.height === size.height) {
          return size;
        }
        return newSize;
      });
    };

    window?.visualViewport.addEventListener("resize", onResize);

    return () => {
      window?.visualViewport.removeEventListener("resize", onResize);
    };
  }, []);

  return size;
}

function getViewportSize(): ViewportSize {
  return {
    width: window?.visualViewport?.width || window?.innerWidth,
    height: window?.visualViewport?.height || window?.innerHeight,
  };
}
