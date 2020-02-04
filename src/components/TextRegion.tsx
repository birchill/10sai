import * as React from 'react';

import { isIOS } from '../utils/ua';

interface Props {
  className?: string;
  children: React.ReactElement<any>;
}

type SizeKeyword = 'x-small' | 'small' | 'medium' | 'large' | 'x-large';

// A block of text where the size of the text content is resized to more-or-less
// fill the region.
//
// Relies on there being CSS selectors defined for the region that match on the
// 'data-size' attribute with keywords 'x-small', 'small', 'medium', 'large',
// 'x-large'. Typically these will define increasing font sizes.
export const TextRegion: React.FC<Props> = props => {
  const [size, setSize] = React.useState<SizeKeyword>('medium');

  const containerElemRef = React.useRef<HTMLDivElement>(null);
  const textElemRef = React.useRef<HTMLDivElement>(null);

  const containerWidth = React.useRef<number>();
  const containerHeight = React.useRef<number>();

  const resizeText = React.useCallback(
    (containerBbox?: ClientRect) => {
      if (!containerElemRef.current || !textElemRef.current) {
        return;
      }

      const bbox =
        containerBbox || containerElemRef.current.getBoundingClientRect();
      const newSize = getBestSize(
        textElemRef.current,
        containerElemRef.current,
        bbox.width,
        bbox.height
      );
      containerWidth.current = bbox.width;
      containerHeight.current = bbox.height;

      if (newSize === size) {
        return;
      }

      setSize(newSize);
    },
    [containerElemRef.current, textElemRef.current, size]
  );

  const handleResize = React.useCallback(() => {
    if (!containerElemRef.current) {
      return;
    }

    const bbox = containerElemRef.current.getBoundingClientRect();
    if (
      bbox.width === containerWidth.current &&
      bbox.height === containerHeight.current
    ) {
      return;
    }

    resizeText(bbox);
  }, [
    containerElemRef.current,
    containerWidth.current,
    containerHeight.current,
    resizeText,
  ]);

  React.useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // This is hacky. We assume that the key of the child roughly corresponds to
  // its contents so that we only need to update the text size if the key
  // changes.
  React.useLayoutEffect(resizeText, [resizeText, props.children.key]);

  // Work around Safari on iOS which lies about layout of offscreen elements
  // unless you wait a while...
  React.useEffect(() => {
    let timeout: number | undefined;
    if (isIOS) {
      timeout = self.setTimeout(resizeText, 500);
    }
    return () => {
      if (timeout) {
        self.clearTimeout(timeout);
      }
    };
  }, [resizeText, props.children.key]);

  const className = `text-region ${props.className || ''}`;

  return (
    <div className={className} ref={containerElemRef} data-size={size}>
      <div className="text" ref={textElemRef}>
        {props.children}
      </div>
    </div>
  );
};

function getBestSize(
  textElem: HTMLElement,
  containerElem: HTMLElement,
  containerWidth: number,
  containerHeight: number
): SizeKeyword {
  // Selectors for [data-size=...] MUST be defined for each of these and they
  // must define increasing font sizes or potentially bad things could happen.
  const sizeKeywords: Array<SizeKeyword> = [
    'x-small',
    'small',
    'medium',
    'large',
    'x-large',
  ];
  let { size } = containerElem.dataset as { size: SizeKeyword };

  const dimensionDiff = (actual: number, ideal: number): number =>
    (actual - ideal) / ideal;
  const xDiff = (bbox: ClientRect): number =>
    dimensionDiff(bbox.width, containerWidth);
  const yDiff = (bbox: ClientRect): number =>
    dimensionDiff(bbox.height, containerHeight);

  let bbox = textElem.getBoundingClientRect();

  // If either dimension is too large, we need to go smaller
  if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
    // Just keep trying smaller sizes while we have them.
    //
    // Technically it would be faster to do a binary subdivision of intervals
    // here but assuming we don't have massive changes to content size (we
    // don't expect to), or sudden changes to container size (uncommon except
    // when flipping a tablet/phone), and assuming we start somewhere at the
    // middle of the range (which is true); then the most a binary subdivision
    // would save would be ~1 relayout, but at the cost of code complexity.
    // And many times it wouldn't save any relayouts at all because word
    // wrapping means the ratio of differences to sizes is not constant.

    let index = sizeKeywords.indexOf(size);
    while (--index >= 0) {
      size = sizeKeywords[index];
      containerElem.dataset.size = size;
      bbox = textElem.getBoundingClientRect();
      if (xDiff(bbox) <= 0 && yDiff(bbox) <= 0) {
        break;
      }
    }
    return size;
  }

  // Both dimensions are smaller.
  //
  // If they're both within 20% of filling the space just keep the font size
  // as-is.
  if (xDiff(bbox) > -0.2 && yDiff(bbox) > -0.2) {
    return size;
  }

  // Just keep trying larger fixed sizes while we have them.
  //
  // As before, we could do this *slightly* more efficiently, but this way is
  // fine for now.
  let index = sizeKeywords.indexOf(size);
  while (++index < sizeKeywords.length) {
    size = sizeKeywords[index];
    containerElem.dataset.size = size;
    bbox = textElem.getBoundingClientRect();
    // If we're too large, just use the previous size.
    if (xDiff(bbox) > 0 || yDiff(bbox) > 0) {
      size = sizeKeywords[--index];
      containerElem.dataset.size = size;
      break;
    }
    // If we're close enough, just use the current size.
    if (xDiff(bbox) > -0.2 && yDiff(bbox) > -0.2) {
      break;
    }
  }
  return size;
}
