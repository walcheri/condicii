import React from "react";

export default function Coast() {
  return <svg className="coast-art" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stopColor="#38326b"/><stop offset=".48" stopColor="#d278ad"/><stop offset="1" stopColor="#ffcc9e"/></linearGradient>
      <linearGradient id="sea" x2="0" y2="1"><stop stopColor="#9473a7"/><stop offset="1" stopColor="#292546"/></linearGradient>
      <linearGradient id="sun" x2="0" y2="1"><stop stopColor="#ffe4b5"/><stop offset="1" stopColor="#ff91b2"/></linearGradient>
      <g id="palm" fill="#211e3c"><path d="M-8 0 Q8 -110 -3 -235 L5 -236 Q25 -110 12 0Z"/><path d="M0 -234 Q-66 -297 -132 -236 Q-66 -258 0 -234 M0 -234 Q-80 -252 -118 -180 Q-75 -220 0 -234 M0 -234 Q-12 -321 56 -311 Q20 -285 0 -234 M0 -234 Q60 -298 131 -245 Q63 -267 0 -234 M0 -234 Q82 -250 116 -174 Q67 -218 0 -234 M0 -234 Q-36 -299 -76 -310 Q-49 -276 0 -234"/></g>
    </defs>
    <path d="M0 0 H900 V600 H0Z" fill="url(#sky)"/>
    <circle cx="570" cy="257" r="116" fill="url(#sun)"/>
    {[280,301,323,344,363].map(y=><path key={y} d={`M440 ${y} H700`} stroke="#d791af" strokeWidth="7"/>)}
    <path d="M0 385 H900 V600 H0Z" fill="url(#sea)"/>
    <path d="M0 389 H900 M260 419 H780 M346 441 H694 M388 467 H655" stroke="#e7b8be" strokeWidth="3" opacity=".45"/>
    <g fill="#423657"><path d="M0 391 V275 H47 V391 M58 391 V309 H113 V391 M121 391 V257 H172 V391 M179 391 V328 H242 V391 M677 391 V321 H723 V391 M728 391 V273 H781 V391 M789 391 V307 H837 V391 M847 391 V237 H900 V391"/></g>
    <g stroke="#f6b3a9" strokeWidth="3" opacity=".55"><path d="M131 280 H162 M131 298 H162 M131 316 H162 M131 334 H162 M740 295 H770 M740 313 H770 M740 331 H770 M860 260 H889 M860 280 H889 M860 300 H889"/></g>
    <path d="M0 532 Q300 476 570 562 L900 546 V600 H0Z" fill="#211e3c"/>
    <use href="#palm" transform="translate(171 588) scale(1.7) rotate(-10)"/>
    <use href="#palm" transform="translate(822 607) scale(1.85) rotate(10)"/>
    <use href="#palm" transform="translate(290 555) scale(.8) rotate(7)"/>
    <path d="M450 169 Q463 155 476 169 M491 152 Q501 142 511 152" fill="none" stroke="#4c365c" strokeWidth="3"/>
  </svg>;
}
