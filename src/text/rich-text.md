10sai Rich Text Serialization
=============================

Motivation
----------

10sai uses it's own serialization format for rich-text. Why don't we
just use the format of draft-js?

Three reasons:

1.  There is every chance we will switch from draft-js to something else in the
    future. It doesn't work well on Android, has a terrible API (it tooks nearly
    a week just to get it to preserve and show selections when tabbing around in
    the way we need), and, being owned by Facebook means it can be a bit
    conservative about accepting PRs and producing new releases so that even if
    we fix a bug, we might have to fork in order to use it.

    So far we have already switched from draft-js to slate and then to draft-js.
    There's every chance we'll make a similar change again (e.g. if Slate gets
    more stable, more slim etc.) and we can't afford to migrate the entire
    database to a new format just for that. Migrations are difficult and
    error-prone (either the client or the data could be updated first, or we
    could even have a situation where the data is only partly updated).

2.  Using our own format is much more compact which means reduced data costs
    (which we pay for).

    Consider the data structure produced by Slate for a simple string with one
    piece of inline style:

```
{
  "object": "value",
  "document": {
    "object": "document",
    "data": {},
    "nodes": [
      {
        "object": "block",
        "type": "line",
        "isVoid": false,
        "data": {},
        "nodes": [
          {
            "object": "text",
            "leaves": [
              {
                "object": "leaf",
                "text": "Testing",
                "marks": [{ "object": "mark", "type": "bold", "data": {} }]
              },
              { "object": "leaf", "text": " something", "marks": [] }
            ]
          }
        ]
      }
    ]
  }
}
```

    That whole thing could be represented as just:

    `Testing*b* something+`

    That would, amongst other benefits, also simplify diffing a lot.

3.  We need to able able to render rich-text without going through an editor
    (e.g. for producing the card overview screen).

So then, why not use HTML?

Basically, because security. HTML is really hard to sanitize. This data is being
loaded off the network and could easily be meddled with. We allow users to setup
their own sync server which can easily alter the data too.

Furthermore, we can't practically put each bit of rich text in locked-down
iframe either since we can have 1000s of these strings on the screen at one
time.

In future we may need to allow HTML in some cases (e.g. very content-rich notes
from third parties), but even if we do, it will probably be for a very
restricted set of circumstances where we treat the blob as un-editable and
probably render it in a sandboxed iframe.

In the general case, we don't want to allow arbitrary HTML.

Format
----------

The 10sai serialization format aims to be compact, somewhat human-readable (but
not necessarily human-editable), and reasonably future proof.

It makes use of PUA (private use area) characters to delineate markup since this
avoids the need to provide an escaping mechanism (e.g. if we used [] to
represent markup, we'd need to support [[ or \[ or something similar to enter
the literal characters and it increases the complexity a lot). This obviously
greatly reduces human-writability but the reduction in complexity is considered
worthwhile.

At the time of writing, there are three private use areas in Unicode: one in the
BMP and two in SMPs. Using the BMP is likely better supported but runs a higher
risk of clashing. For example, Charis SIL is known to use some codepoints in the
BMP PUA and it would be nice not to clash with that (since this is
a language-learning app and it's conceivable a linguistic might want to use this
font if they know it's always going to be available and they can apply a user
stylesheet to force 10sai to use it).

So instead we use SPUA-B starting from U+105A10. Any characters in the range
U+105A10 - U+105AFF are stripped from text input to avoid clashing.

At the root-level, rich text is represented as a series of blocks. Blocks are
separated by newlines characters (U+000A). This gives some degree of
human-readability. If we need to represent newlines within block in future we
can use NEL (U+0085) or LS / PS (U+2028 / U+2029) for this. These characters
should be stripped from text input to ensure they don't conflict confusion in
future.

By default, blocks have the 'text' type.

Other types of blocks ('image' etc.) begin with the character U+105A1B. The full
details of such blocks has yet to be determined but will likely consist of:

* One U+105A1B character
* One or more characters in the [a-z] range indicating the block type
* An optional U+105A1
* One U+105A1E character to mark the end of the block header

We do not currently support nested blocks. If they become necessary, they
will likely be supported by introducing a new block type.

Inline markup is used to represent both styled ranges (marks in Slate
terminology) and also custom inline types (entities in Draft terminology).
Each inline range can have multiple style types set but only one custom inline
type. That is, if two entities cover the same range, one will have to wrap the
other.

Inline ranges are strictly nested.

They take the format:

* An initial U+105A10 character to mark the start of the inline range.
* A sequence of 0 or more headers separated by U+105AD characters.
  * Each header is either:
    * A custom inline type header taking the format:
      !<type>[:<data>]
      (That is, an initial ! U+0021 character followed by a type string
      consisting of one or more characters which can include any character
      except a ':' or a character in the U+105A10~U+105AFF range, optionally
      followed by a ':' character and one or more or characters describing data
      parameters for the type--likewise made up of any character not in the
      U+105A10~U+105AFF range.)

      Only the first such type header is recognized. Any subsequent type headers
      will be ignored.

    * A style name (any string that doesn't start with !)
* For custom inline types an optional sequence of the following:
* A U+105A11 character to mark the end of the inline range header
* Text content or other inline ranges
* A U+105A1C character to mark the end of the inline range

Summary of special characters
-----------------------------

| Character | Raw | Meaning                                       |
| --------- | --- | --------------------------------------------- |
| U+105A10  | 􅨐   | Inline range start (0 = open)                 |
| U+105A11  | 􅨑   | Inline range header end                       |
| U+105A1B  | 􅨛   | Block start (non-text type, B = block)        |
| U+105A1C  | 􅨜   | Inline range end (C = close)                  |
| U+105A1D  | 􅨝   | Inline range header delimeter (D = delimeter) |
