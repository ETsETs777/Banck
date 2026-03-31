/** Выполнить в `next/script` strategy="beforeInteractive", чтобы убрать мигание темы. */
export const BEFORE_INTERACTIVE_THEME_SCRIPT =
  "(()=>{try{var t=localStorage.getItem('spektors.theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);return;}var m=typeof matchMedia!=='undefined'&&matchMedia('(prefers-color-scheme: light)').matches;document.documentElement.setAttribute('data-theme',m?'light':'dark');}catch(e){}})();";

export const THEME_STORAGE_KEY = "spektors.theme";
