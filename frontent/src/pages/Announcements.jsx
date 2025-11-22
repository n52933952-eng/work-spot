import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Heading,
  useToast,
  Button,
  Icon,
  HStack,
  Select,
  Spinner,
  Center,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  Checkbox,
  CheckboxGroup,
  Stack,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Divider,
} from '@chakra-ui/react';
import { FiBell, FiPlus, FiTrash2 } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { announcementsAPI, dashboardAPI } from '../services/api';

const typeOptions = [
  { value: '', label: 'كل الأنواع' },
  { value: 'general', label: 'عام' },
  { value: 'urgent', label: 'عاجل' },
  { value: 'event', label: 'فعالية' },
];

const typeLabels = {
  general: { label: 'عام', colorScheme: 'blue' },
  urgent: { label: 'عاجل', colorScheme: 'red' },
  event: { label: 'فعالية', colorScheme: 'purple' },
};

const audienceLabels = {
  all: { label: 'جميع الموظفين', colorScheme: 'green' },
  specific: { label: 'مستخدمون محددون', colorScheme: 'orange' },
  department: { label: 'قسم محدد', colorScheme: 'blue' },
  role: { label: 'دور وظيفي', colorScheme: 'teal' },
};

const targetOptions = [
  { value: '', label: 'كل الجمهور' },
  { value: 'all', label: 'جميع الموظفين' },
  { value: 'specific', label: 'مستخدمون محددون' },
];

const Announcements = () => {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterAudience, setFilterAudience] = useState('');
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general',
    targetAudience: 'all',
    specificUsers: [],
    expiresAt: '',
  });
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    isOpen: isCreateOpen,
    onOpen: onCreateOpen,
    onClose: onCreateClose,
  } = useDisclosure();

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const cancelDeleteRef = useRef();

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType) params.type = filterType;
      if (filterAudience) params.targetAudience = filterAudience;
      const data = await announcementsAPI.getAll(params);
      setAnnouncements(data.announcements || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحميل الإعلانات',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [filterAudience, filterType, toast]);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await dashboardAPI.getAllEmployees({ isActive: true });
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Failed to load employees', error);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleOpenCreate = () => {
    setFormData({
      title: '',
      content: '',
      type: 'general',
      targetAudience: 'all',
      specificUsers: [],
      expiresAt: '',
    });
    onCreateOpen();
  };

  const handleCreateAnnouncement = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: 'تنبيه',
        description: 'الرجاء إدخال العنوان والمحتوى',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (formData.targetAudience === 'specific' && formData.specificUsers.length === 0) {
      toast({
        title: 'تنبيه',
        description: 'الرجاء اختيار مستخدم واحد على الأقل',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        type: formData.type,
        targetAudience: formData.targetAudience,
        specificUsers: formData.targetAudience === 'specific' ? formData.specificUsers : [],
        expiresAt: formData.expiresAt || null,
      };

      const result = await announcementsAPI.create(payload);
      setAnnouncements(prev => [result.announcement, ...prev]);
      toast({
        title: 'تم الإرسال',
        description: 'تم إنشاء الإعلان بنجاح',
        status: 'success',
        duration: 3000,
      });
      onCreateClose();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل إنشاء الإعلان',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = (announcement) => {
    setSelectedAnnouncement(announcement);
    onDeleteOpen();
  };

  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;
    setIsDeleting(true);
    try {
      await announcementsAPI.delete(selectedAnnouncement._id);
      setAnnouncements(prev => prev.filter(a => a._id !== selectedAnnouncement._id));
      toast({
        title: 'تم الحذف',
        description: 'تم حذف الإعلان بنجاح',
        status: 'success',
        duration: 3000,
      });
      onDeleteClose();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل حذف الإعلان',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formattedAnnouncements = useMemo(() => announcements, [announcements]);

  const renderAudience = (announcement) => {
    const info = audienceLabels[announcement.targetAudience] || audienceLabels.all;
    const specificNames = (announcement.specificUsers || [])
      .map(user => (typeof user === 'string' ? user : user.fullName))
      .filter(Boolean)
      .join('، ');

    return (
      <VStack align="flex-start" spacing={1}>
        <Badge colorScheme={info.colorScheme}>{info.label}</Badge>
        {announcement.targetAudience === 'specific' && specificNames && (
          <Text fontSize="sm" color="gray.600">
            {specificNames}
          </Text>
        )}
      </VStack>
    );
  };

  return (
    <MainLayout>
      <Box>
        <Heading mb={6} display="flex" alignItems="center" gap={3}>
          <Icon as={FiBell} />
          الإعلانات
        </Heading>

        <Card mb={6}>
          <CardBody>
            <HStack spacing={4} flexWrap="wrap">
              <FormControl w={['100%', '200px']}>
                <FormLabel fontSize="sm">نوع الإعلان</FormLabel>
                <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  {typeOptions.map(option => (
                    <option key={option.value || 'all-types'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl w={['100%', '200px']}>
                <FormLabel fontSize="sm">الجمهور المستهدف</FormLabel>
                <Select value={filterAudience} onChange={(e) => setFilterAudience(e.target.value)}>
                  {targetOptions.map(option => (
                    <option key={option.value || 'all-targets'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <Button
                ml="auto"
                leftIcon={<Icon as={FiPlus} />}
                colorScheme="blue"
                onClick={handleOpenCreate}
              >
                إعلان جديد
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {loading ? (
          <Center py={20}>
            <Spinner size="xl" color="blue.500" />
          </Center>
        ) : (
          <Card>
            <CardBody p={0}>
              {formattedAnnouncements.length === 0 ? (
                <Center py={20}>
                  <Text color="gray.500">لا توجد إعلانات بعد.</Text>
                </Center>
              ) : (
                <Table variant="simple">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th>العنوان</Th>
                      <Th>النوع</Th>
                      <Th>الجمهور</Th>
                      <Th>التاريخ</Th>
                      <Th>المرسل</Th>
                      <Th textAlign="center">إجراءات</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {formattedAnnouncements.map((announcement) => {
                      const typeInfo = typeLabels[announcement.type] || typeLabels.general;
                      const createdAt = new Date(announcement.createdAt);
                      return (
                        <Tr key={announcement._id}>
                          <Td>
                            <Text fontWeight="bold">{announcement.title}</Text>
                            <Text fontSize="sm" color="gray.600" noOfLines={2}>
                              {announcement.content}
                            </Text>
                          </Td>
                          <Td>
                            <Badge colorScheme={typeInfo.colorScheme}>{typeInfo.label}</Badge>
                          </Td>
                          <Td>{renderAudience(announcement)}</Td>
                          <Td>
                            <Text fontSize="sm">
                              {createdAt.toLocaleDateString('ar-EG', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {createdAt.toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontSize="sm">
                              {typeof announcement.createdBy === 'string'
                                ? announcement.createdBy
                                : announcement.createdBy?.fullName || 'غير معروف'}
                            </Text>
                          </Td>
                          <Td textAlign="center">
                            <Button
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              leftIcon={<Icon as={FiTrash2} />}
                              onClick={() => handleConfirmDelete(announcement)}
                            >
                              حذف
                            </Button>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        )}
      </Box>

      {/* Create Announcement Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>إعلان جديد</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>عنوان الإعلان</FormLabel>
                <Input
                  placeholder="اكتب عنواناً مميزاً"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>المحتوى</FormLabel>
                <Textarea
                  placeholder="اكتب نص الإعلان بالتفصيل"
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
              </FormControl>

              <HStack spacing={4} flexWrap="wrap">
                <FormControl flex="1">
                  <FormLabel>نوع الإعلان</FormLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    {typeOptions
                      .filter((option) => option.value)
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                  </Select>
                </FormControl>

                <FormControl flex="1">
                  <FormLabel>الجمهور المستهدف</FormLabel>
                  <Select
                    value={formData.targetAudience}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetAudience: e.target.value,
                        specificUsers: [],
                      })
                    }
                  >
                    <option value="all">جميع الموظفين</option>
                    <option value="specific">مستخدمون محددون</option>
                  </Select>
                </FormControl>
              </HStack>

              {formData.targetAudience === 'specific' && (
                <FormControl>
                  <FormLabel>اختر الموظفين</FormLabel>
                  <Box
                    borderWidth="1px"
                    borderRadius="md"
                    p={3}
                    maxH="200px"
                    overflowY="auto"
                  >
                    <CheckboxGroup
                      value={formData.specificUsers}
                      onChange={(values) =>
                        setFormData({
                          ...formData,
                          specificUsers: values,
                        })
                      }
                    >
                      <Stack spacing={2}>
                        {employees.length === 0 ? (
                          <Text fontSize="sm" color="gray.500">
                            لا يوجد موظفون متاحون
                          </Text>
                        ) : (
                          employees.map((employee) => (
                            <Checkbox key={employee._id} value={employee._id}>
                              {employee.fullName} ({employee.employeeNumber})
                            </Checkbox>
                          ))
                        )}
                      </Stack>
                    </CheckboxGroup>
                  </Box>
                </FormControl>
              )}

              <Divider />

              <FormControl>
                <FormLabel>تاريخ الانتهاء (اختياري)</FormLabel>
                <Input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  min={new Date().toISOString().slice(0, 10)}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              إلغاء
            </Button>
            <Button colorScheme="blue" onClick={handleCreateAnnouncement} isLoading={isSubmitting}>
              نشر الإعلان
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete confirmation */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelDeleteRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              حذف الإعلان
            </AlertDialogHeader>

            <AlertDialogBody>
              هل أنت متأكد أنك تريد حذف هذا الإعلان؟ لا يمكن التراجع عن هذه العملية.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelDeleteRef} onClick={onDeleteClose}>
                إلغاء
              </Button>
              <Button colorScheme="red" ml={3} onClick={handleDeleteAnnouncement} isLoading={isDeleting}>
                حذف
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </MainLayout>
  );
};

export default Announcements;

