const dv={default:"bg-surface-2 border border-surface-3 rounded-card shadow-card",elevated:"bg-surface-2 border border-surface-4 rounded-card shadow-modal",interactive:"bg-surface-2 border border-surface-3 rounded-card shadow-card hover:shadow-card-hover hover:border-surface-4 cursor-pointer transition-all duration-150 ease-out"};
export function SkeletonBlock({className = "h-4 w-full", count = 1}) {
  return (
    <div className="space-y-2">
      {Array.from({length: count}, (_, i) => (
        <div key={i} className={`shimmer-block ${className}`} />
      ))}
    </div>
  );
}

export function SkeletonCard({lines = 3, children}) {
  return (
    <div className="card-premium overflow-hidden p-5 space-y-3">
      <SkeletonBlock className="h-5 w-1/3" />
      <SkeletonBlock className="h-3 w-2/3" count={lines} />
      {children}
    </div>
  );
}

export default function Card({children,className="",variant="default",padding=true,onClick,...props}){return<div className={dv[variant]+(padding?" px-5 py-4":"")+" "+className} onClick={onClick} role={onClick?"button":undefined} tabIndex={onClick?0:undefined} onKeyDown={onClick?(e)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick(e)}}:undefined} {...props}>{children}</div>;}