function n(t){if(!t)return!1;if(t.isContentEditable)return!0;let e=t.tagName;return e==="INPUT"||e==="TEXTAREA"}function r(){return n(document.activeElement)}export{n as a,r as b};
