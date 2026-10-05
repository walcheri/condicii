import React from "react";

export default function ItemArt({ skin }) {
  if (!skin) return <div className="skin-art empty-art">＋</div>;
  return <div className="skin-art" style={{ "--skin-color": skin.color }}>
    <svg viewBox="0 0 260 150" aria-hidden="true" className={`art-${skin.kind}`}>
      <ellipse cx="130" cy="132" rx="69" ry="7" fill="#000" opacity=".22" />
      {skin.kind === "watermelon" && <>
        <path d="M45 55 A85 85 0 0 0 215 55Z" fill="#33885c" />
        <path d="M53 55 A77 77 0 0 0 207 55Z" fill="#c8ee97" />
        <path d="M61 55 A69 69 0 0 0 199 55Z" fill="#ff7181" />
        {[85,115,145,175].map((x,i)=><ellipse key={x} cx={x} cy={75+(i%2)*18} rx="3" ry="5" fill="#44273e" transform={`rotate(${(i-1.5)*20} ${x} 80)`}/>)}
      </>}
      {skin.kind === "pumpkin" && <>
        <path d="M127 43 Q116 21 140 19 L144 28 Q129 27 140 45" fill="#689954"/>
        <ellipse cx="100" cy="85" rx="42" ry="44" fill="#ea732c"/><ellipse cx="159" cy="85" rx="42" ry="44" fill="#ea732c"/>
        <ellipse cx="130" cy="85" rx="45" ry="48" fill="#ffa347"/><ellipse cx="130" cy="85" rx="22" ry="48" fill="#ffb862"/>
      </>}
      {skin.kind === "dumplings" && <>
        <ellipse cx="130" cy="104" rx="87" ry="29" fill="#8ea8bc"/><ellipse cx="130" cy="97" rx="87" ry="29" fill="#dfeef5"/>
        {[[93,88],[135,77],[167,96],[121,108]].map(([x,y])=><g key={x} transform={`translate(${x} ${y})`}><path d="M-26 3 Q-24 -25 0 -20 Q25 -22 26 3 Q0 24 -26 3" fill="#f5dcaf" stroke="#cca985" strokeWidth="2"/><path d="M-20 2 Q0 -10 20 2" fill="none" stroke="#c89f7b" strokeWidth="2"/></g>)}
      </>}
      {skin.kind === "water" && <>
        <rect x="116" y="17" width="28" height="14" rx="3" fill="#fe5557"/>
        <path d="M115 31 L115 43 Q99 53 99 66 V118 Q99 132 111 132 H149 Q161 132 161 118 V66 Q161 53 145 43 V31Z" fill="#83e0eb" stroke="#c5f5f8" strokeWidth="2"/>
        <path d="M106 62 V119" stroke="#dffcff" strokeWidth="5" opacity=".7"/>
        <rect x="98" y="73" width="64" height="33" rx="4" fill="#ffdf50"/>
        <text x="130" y="96" textAnchor="middle" fontSize="23" fontWeight="900" fill="#26213a">Я</text>
      </>}
      {skin.kind === "disc" && <>
        <rect x="68" y="17" width="99" height="115" rx="5" fill="#151b3c" stroke="#bd98e0" strokeWidth="3"/>
        <rect x="75" y="26" width="85" height="97" rx="2" fill="#fb94bb"/>
        <path d="M75 97 L98 58 L110 79 L139 47 L160 97 V123 H75Z" fill="#6861aa"/>
        <text x="118" y="58" textAnchor="middle" fontWeight="900" fontSize="22" fill="#fff8ee">GTA</text>
        <text x="118" y="101" textAnchor="middle" fontWeight="900" fontSize="39" fill="#fff8ee">VI</text>
        <circle cx="177" cy="105" r="29" fill="#e7deed" stroke="#a09bcb" strokeWidth="2"/><circle cx="177" cy="105" r="9" fill="#77618b"/>
      </>}
      {skin.kind === "date" && <>
        <rect x="59" y="33" width="142" height="88" rx="9" fill="#fbe2cf" transform="rotate(-8 130 77)"/>
        <path d="M131 97 L93 63 C71 32 110 28 131 52 C152 28 191 32 169 63Z" fill="#f36ba0"/>
        <path d="M183 25 V44 M174 34 H192 M74 102 V119 M66 110 H82" stroke="#ffce89" strokeWidth="4"/>
        <text x="130" y="119" textAnchor="middle" fill="#6c3959" fontSize="12" fontWeight="800">ЗАЛМА</text>
      </>}
      {skin.kind === "fox" && <>
        <path d="M163 86 Q232 62 207 29 Q248 65 220 113 Q194 145 150 121" fill="#ffa353"/><path d="M207 29 Q239 52 230 79 L210 69Z" fill="#fff1d7"/>
        <ellipse cx="127" cy="104" rx="43" ry="30" fill="#f18b47"/>
        <path d="M79 83 L79 28 L110 46 L148 45 L180 28 L176 84 L128 115Z" fill="#ffad60"/>
        <path d="M86 40 L105 55 L86 64 M169 40 L151 55 L169 64" fill="#824666"/>
        <path d="M83 82 L128 96 L174 82 L128 115Z" fill="#fff1d7"/>
        <path d="M108 76 L115 80 M141 80 L148 76" stroke="#3c2540" strokeWidth="4" strokeLinecap="round"/><path d="M120 96 H136 L128 103Z" fill="#3c2540"/>
      </>}
      {skin.kind === "car" && <>
        <path d="M39 85 L65 75 L91 44 H165 L195 75 L221 83 V113 H39Z" fill="#d4e2f0" stroke="#657c9b" strokeWidth="2"/>
        <path d="M98 51 H129 V75 H78Z M137 51 H162 L184 75 H137Z" fill="#343b65"/>
        <path d="M42 85 H214 L211 98 H46Z" fill="#adbed5"/>
        <rect x="181" y="84" width="30" height="9" rx="3" fill="#fff3b4"/>
        <rect x="43" y="86" width="18" height="8" rx="3" fill="#fb7b9a"/>
        {[77,184].map(x=><g key={x}><circle cx={x} cy="112" r="19" fill="#20263d"/><circle cx={x} cy="112" r="10" fill="#9daabd"/><circle cx={x} cy="112" r="4" fill="#475c77"/></g>)}
        <path d="M104 91 H161" stroke="#6c7f9e" strokeWidth="3"/>
      </>}
    </svg>
  </div>;
}
