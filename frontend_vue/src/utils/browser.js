export const getBrowserWindow = () => (typeof window === "undefined" ? null : window);

export const getLocalStorage = () => {
  const browserWindow = getBrowserWindow();
  return browserWindow?.localStorage || null;
};

export const dispatchBrowserEvent = (name) => {
  const browserWindow = getBrowserWindow();
  if (browserWindow && typeof CustomEvent !== "undefined") {
    browserWindow.dispatchEvent(new CustomEvent(name));
  }
};
