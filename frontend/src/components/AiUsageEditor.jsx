import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Bold, ChevronDown, Underline as UnderlineIcon } from 'lucide-react';

const TEXT_COLORS = [
  ['#243047', '기본색'],
  ['#062983', '파란색'],
  ['#d12435', '빨간색'],
  ['#168a53', '초록색'],
  ['#7c3aed', '보라색'],
  ['#c26a00', '주황색'],
];

const insertPastedImage = (view, event) => {
  const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
  if (!imageItem) return false;

  const file = imageItem.getAsFile();
  if (!file) return false;

  event.preventDefault();
  const reader = new FileReader();
  reader.onload = () => {
    const imageNode = view.state.schema.nodes.image?.create({ src: reader.result });
    if (!imageNode) return;
    view.dispatch(view.state.tr.replaceSelectionWith(imageNode).scrollIntoView());
  };
  reader.readAsDataURL(file);
  return true;
};

export default function AiUsageEditor({ value, onChange }) {
  const [isColorOpen, setIsColorOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      TextStyle,
      Color,
      Underline,
      Image.configure({ allowBase64: true }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'ai-usage-rich-editor-content',
        'aria-label': '활용법 내용',
      },
      handlePaste: insertPastedImage,
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = value || '';
    if (editor.getHTML() !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="ai-usage-rich-editor loading" />;

  const currentColor = editor.getAttributes('textStyle').color || '#243047';

  return (
    <>
      <div className="ai-usage-editor-toolbar" aria-label="본문 서식">
        <button
          className={`editor-tool-btn ${editor.isActive('bold') ? 'active' : ''}`}
          type="button"
          title="굵게"
          aria-label="굵게"
          aria-pressed={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </button>
        <button
          className={`editor-tool-btn ${editor.isActive('underline') ? 'active' : ''}`}
          type="button"
          title="밑줄"
          aria-label="밑줄"
          aria-pressed={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={15} />
        </button>
        <div className="editor-color-menu" aria-label="글 색상">
          <button
            className={`editor-color-main ${isColorOpen ? 'active' : ''}`}
            type="button"
            title="글 색상"
            aria-label="글 색상"
            aria-expanded={isColorOpen}
            style={{ '--current-text-color': currentColor }}
            onClick={() => setIsColorOpen((current) => !current)}
          >
            <span className="editor-color-letter">A</span>
            <ChevronDown size={12} />
          </button>
          {isColorOpen && (
            <div className="editor-color-palette" role="menu">
              {TEXT_COLORS.map(([color, label]) => (
                <button
                  className="editor-color-option"
                  type="button"
                  key={color}
                  role="menuitem"
                  title={label}
                  aria-label={label}
                  style={{ '--swatch-color': color }}
                  onClick={() => {
                    editor.chain().focus().setColor(color).run();
                    setIsColorOpen(false);
                  }}
                >
                  <span className="editor-color-swatch" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <EditorContent className="ai-usage-rich-editor" editor={editor} />
    </>
  );
}
