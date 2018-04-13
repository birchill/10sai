import React from 'react';

import Link from './Link';
import TabBlock from './TabBlock.jsx';

interface Props {
  className?: string;
  activeTab?: 'lookup' | 'edit-card' | 'review';
  activeCardId?: string;
  remainingReviews?: number;
}

const MainTabBlock: React.SFC<Props> = props => {
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

  return (
    <TabBlock active={activeIndex} className={classes.join(' ')}>
      <Link
        id="lookup-tab"
        href={lookupLink}
        aria-controls="lookup-page"
        className="-icon -lookup"
      >
        Lookup
      </Link>
      <Link
        id="edit-tab"
        href={addEditLink}
        aria-controls="edit-page"
        className={`-icon ${addEditClass}`}
      >
        {addEditLabel}
      </Link>
      <Link
        id="review-tab"
        href={reviewLink}
        aria-controls="review-page"
        className={`-icon -review ${props.remainingReviews ? '-badge' : ''}`}
        data-badge={props.remainingReviews}
      >
        Review
      </Link>
    </TabBlock>
  );
};

export default MainTabBlock;
