import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

const Svg: React.FC<{ children: React.ReactNode; size?: number; className?: string; viewBox?: string }> = ({
  children, size = 18, className = '', viewBox = '0 0 24 24',
}) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const IconHome: React.FC<IconProps> = (p) => <Svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Svg>;
export const IconShopping: React.FC<IconProps> = (p) => <Svg {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></Svg>;
export const IconCompare: React.FC<IconProps> = (p) => <Svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Svg>;
export const IconExpense: React.FC<IconProps> = (p) => <Svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></Svg>;
export const IconFlow: React.FC<IconProps> = (p) => <Svg {...p}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></Svg>;
export const IconTools: React.FC<IconProps> = (p) => <Svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></Svg>;
export const IconBell: React.FC<IconProps> = (p) => <Svg {...p}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></Svg>;
export const IconUser: React.FC<IconProps> = (p) => <Svg {...p}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>;
export const IconPlus: React.FC<IconProps> = (p) => <Svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
export const IconCheck: React.FC<IconProps> = (p) => <Svg {...p}><polyline points="20 6 9 17 4 12"/></Svg>;
export const IconTrash: React.FC<IconProps> = (p) => <Svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></Svg>;
export const IconEdit: React.FC<IconProps> = (p) => <Svg {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></Svg>;
export const IconChevronDown: React.FC<IconProps> = (p) => <Svg {...p}><polyline points="6 9 12 15 18 9"/></Svg>;
export const IconChevronUp: React.FC<IconProps> = (p) => <Svg {...p}><polyline points="18 15 12 9 6 15"/></Svg>;
export const IconChevronRight: React.FC<IconProps> = (p) => <Svg {...p}><polyline points="9 18 15 12 9 6"/></Svg>;
export const IconSearch: React.FC<IconProps> = (p) => <Svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>;
export const IconCalendar: React.FC<IconProps> = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>;
export const IconDownload: React.FC<IconProps> = (p) => <Svg {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>;
export const IconUpload: React.FC<IconProps> = (p) => <Svg {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></Svg>;
export const IconBook: React.FC<IconProps> = (p) => <Svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></Svg>;
export const IconMap: React.FC<IconProps> = (p) => <Svg {...p}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></Svg>;
export const IconPiggy: React.FC<IconProps> = (p) => <Svg {...p}><path d="M19 5c-1.5 0-2.8.8-3.5 2H7a2 2 0 00-2 2v1c-1.2 0-2 .8-2 2s.8 2 2 2v1a2 2 0 002 2h8.5c.7 1.2 2 2 3.5 2 2.2 0 4-1.8 4-4V9c0-2.2-1.8-4-4-4z"/></Svg>;
export const IconClock: React.FC<IconProps> = (p) => <Svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>;
export const IconShield: React.FC<IconProps> = (p) => <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Svg>;
export const IconStar: React.FC<IconProps> = (p) => <Svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Svg>;
export const IconDollar: React.FC<IconProps> = (p) => <Svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></Svg>;
export const IconAlert: React.FC<IconProps> = (p) => <Svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Svg>;
export const IconMenu: React.FC<IconProps> = (p) => <Svg {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></Svg>;
export const IconX: React.FC<IconProps> = (p) => <Svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
export const IconArrowRight: React.FC<IconProps> = (p) => <Svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></Svg>;
export const IconWrench: React.FC<IconProps> = (p) => <Svg {...p}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></Svg>;
export const IconLayout: React.FC<IconProps> = (p) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></Svg>;
export const IconToggle: React.FC<IconProps> = (p) => <Svg {...p} viewBox="0 0 24 24"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3"/></Svg>;
export const IconImage: React.FC<IconProps> = (p) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></Svg>;
