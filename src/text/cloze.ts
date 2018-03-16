export function extractKeywordsFromCloze(
  prompt: string,
  answer: string
): string[] {
  const result: string[] = [];

  let remainder = prompt;
  let matches;
  while (
    remainder.length &&
    (matches = remainder.match(/(?:^|\])(.*?)\[([^\]]+)\](.*?)(\[|$)/))
  ) {
    // On the next iteration we should start searching from the beginning of the
    // epilogue on this iteration.
    remainder = remainder.substr(
      matches.index! + matches[0].length - matches[3].length - matches[4].length
    );
    const [, prologue, , epilogue] = matches;

    // Check we have the prologue in the answer
    const preIndex = answer.indexOf(prologue);
    if (preIndex === -1) {
      continue;
    }
    const matchStart = preIndex + prologue.length;

    // Check we have the epilogue in the answer
    let matchEnd;
    if (epilogue.length) {
      const postIndex = answer.indexOf(epilogue, matchStart);
      if (postIndex === -1) {
        continue;
      }
      matchEnd = postIndex;
      // If the epilogue was empty and the hint ends at the end of the string,
      // then we just want to use the remainder of the answer as the
      // corresponding text.
    } else if (!remainder.length) {
      matchEnd = answer.length;
      // If the epilogue was empty but there was still other text (e.g.
      // *another* cloze adjacent to this one) then there's no way for us to
      // tell which text corresponds to this cloze so just give up.
    } else {
      continue;
    }

    if (matchStart === matchEnd) {
      continue;
    }

    result.push(answer.substring(matchStart, matchEnd));
    answer = answer.substr(matchEnd);
  }

  return result;
}
