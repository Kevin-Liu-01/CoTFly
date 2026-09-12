/** The lab owns focus while its child arena remains visible and animating. */
export function createFlyFrameDocument(host: Window) {
  let owner: Document;
  try {
    owner = host.parent.document;
  } catch {
    owner = host.document;
  }
  return {
    inputTarget: owner.defaultView ?? host,
    get hidden() {
      return owner.hidden;
    },
    hasFocus: () => !owner.hidden && owner.hasFocus(),
    addEventListener: owner.addEventListener.bind(owner),
    removeEventListener: owner.removeEventListener.bind(owner),
  };
}
