import * as React from 'react';

import { localizeShortcut } from '../utils/keyboard';

import { Link } from './Link';
import { TabBlock } from './TabBlock';

export type TabName = 'lookup' | 'edit-card' | 'review';

interface Props {
  className?: string;
  activeTab?: TabName;
  activeCardId?: string;
  remainingReviews?: number;
}

export const MainTabBlock: React.FC<Props> = props => {
  const classes: string[] = ['tabbar'];
  if (props.className) {
    classes.push(...props.className.trim().split(/\s+/));
  }

  const lookupLink = props.activeTab === 'lookup' ? '/' : '/lookup';

  const [addEditLabel, addEditClass] = props.activeCardId
    ? ['Edit', '-edit-card']
    : ['Add', '-add-card'];
  let addEditLink;
  if (props.activeTab === 'edit-card') {
    addEditLink = '/';
  } else if (props.activeCardId) {
    addEditLink = `/cards/${props.activeCardId}`;
  } else {
    addEditLink = '/cards/new';
  }

  const reviewLink = props.activeTab === 'review' ? '/' : '/review';

  const activeIndex = props.activeTab
    ? ['lookup', 'edit-card', 'review'].indexOf(props.activeTab)
    : undefined;

  const editTitle = props.activeCardId
    ? 'Edit'
    : `Add (C, ${localizeShortcut('Ctrl+Alt+C')})`;

  return (
    <TabBlock active={activeIndex} className={classes.join(' ')}>
      <Link
        id="lookup-tab"
        href={lookupLink}
        aria-controls="lookup-page"
        className="-icon -lookup"
        title={`Lookup (L, ${localizeShortcut('Ctrl+Alt+L')})`}
      >
        Lookup
      </Link>
      <Link
        id="edit-tab"
        href={addEditLink}
        aria-controls="edit-page"
        className={`-icon ${addEditClass}`}
        title={editTitle}
      >
        {addEditLabel}
      </Link>
      <Link
        id="review-tab"
        href={reviewLink}
        aria-controls="review-page"
        className={`-icon -review ${props.remainingReviews ? '-badge' : ''}`}
        data-badge={props.remainingReviews}
        title={`Review (R, ${localizeShortcut('Ctrl+Alt+R')})`}
      >
        Review
      </Link>
    </TabBlock>
  );
};
