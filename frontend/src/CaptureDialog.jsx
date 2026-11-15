import React, {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import './captureDialog.css';

export default function CaptureDialog({title,onClose,children}) {
  const ref=useRef(null);
  useEffect(()=>{
    const dialog=ref.current;
    const shell=dialog.closest('.phoneShell');
    const fit=()=>{
      if (!shell) return;
      const bounds=shell.getBoundingClientRect();
      const banner=shell.querySelector('.bannerWrap')?.getBoundingClientRect();
      const width=Math.min(bounds.width-16,window.innerWidth-16);
      const left=Math.max(8,Math.min(bounds.left+8,window.innerWidth-width-8));
      const top=Math.max(8,Math.min(banner?.bottom || bounds.top+8,window.innerHeight-160));
      const bottom=Math.min(bounds.bottom-8,window.innerHeight-8);
      Object.assign(dialog.style,{position:'fixed',margin:'0',left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${Math.max(120,bottom-top)}px`,maxHeight:`${Math.max(120,bottom-top)}px`});
    };
    dialog.showModal();
    fit();
    const observer=new ResizeObserver(fit); if(shell) observer.observe(shell);
    window.addEventListener('resize',fit); window.addEventListener('scroll',fit,true);
    window.visualViewport?.addEventListener('resize',fit);
    return ()=>{observer.disconnect();window.removeEventListener('resize',fit);window.removeEventListener('scroll',fit,true);window.visualViewport?.removeEventListener('resize',fit);dialog.close();};
  },[]);
  return <dialog ref={ref} className="captureDialog" aria-labelledby="capture-dialog-title" onCancel={onClose}>
    <header className="captureDialogHeader"><h2 id="capture-dialog-title">{title}</h2><button type="button" aria-label="Close capture window" onClick={onClose}><X size={22}/></button></header>
    <div className="captureDialogBody">{children}</div>
  </dialog>;
}
