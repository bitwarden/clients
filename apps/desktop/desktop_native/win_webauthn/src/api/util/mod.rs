pub(crate) mod cbor;

pub struct ArrayPointerIterator<'a, T> {
    pos: usize,
    list: Option<&'a [T]>,
}

impl<T> ArrayPointerIterator<'_, T> {
    /// # Safety
    /// The caller must ensure that the pointer and length is
    /// valid. A null pointer returns an empty iterator.
    pub unsafe fn new(data: *const T, len: usize) -> Self {
        let slice = if !data.is_null() {
            Some(std::slice::from_raw_parts(data, len))
        } else {
            None
        };
        Self {
            pos: 0,
            list: slice,
        }
    }
}

impl<'a, T> Iterator for ArrayPointerIterator<'a, T> {
    type Item = &'a T;

    fn next(&mut self) -> Option<Self::Item> {
        let current = self.list?.get(self.pos);
        self.pos += 1;
        current
    }
}

pub(crate) trait WindowsString {
    fn to_utf16(&self) -> Vec<u16>;
}

impl WindowsString for str {
    fn to_utf16(&self) -> Vec<u16> {
        // null-terminated UTF-16
        self.encode_utf16().chain(std::iter::once(0)).collect()
    }
}
